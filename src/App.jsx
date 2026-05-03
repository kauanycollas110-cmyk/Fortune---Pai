import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const STORAGE_KEY = "fortuna_data_v1";
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
const pct = (v) => `${Math.min(Math.round(v), 999)}%`;

const CATS = ["🍔 Alimentação", "🏠 Moradia", "🚗 Transporte", "💡 Contas", "💊 Saúde", "🎮 Lazer", "👗 Roupas", "📚 Educação", "🛒 Mercado", "📱 Assinaturas", "👶 Filhos", "🐾 Pets", "💳 Outros"];
const CAT_COLORS = ["#DC2626","#D4A84B","#3B82F6","#EAB308","#22C55E","#8B5CF6","#F97316","#6366F1","#14B8A6","#A855F7","#EC4899","#78716C","#525252"];

const EMPTY = { setupDone: false, familyName: "", members: [], incomes: [], fixedExpenses: [], creditCards: [], transactions: [], geminiKey: "" };

const Tip = ({ text }) => {
  const [s, setS] = useState(false);
  return (
    <span style={{ position: "relative", marginLeft: 6, cursor: "help", display: "inline-block" }} onMouseEnter={() => setS(true)} onMouseLeave={() => setS(false)} onClick={() => setS(!s)}>
      <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#27272A", color: "#71717A", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>?</span>
      {s && <span style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#27272A", color: "#D4D4D8", padding: "8px 12px", borderRadius: 8, fontSize: 11, width: 230, lineHeight: 1.5, zIndex: 99, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>{text}</span>}
    </span>
  );
};

export default function Fortuna() {
  const [data, setData] = useState(EMPTY);
  const [tab, setTab] = useState("painel");
  const [toast, setToast] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(null);
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [setupFamily, setSetupFamily] = useState("");
  const [setupMembers, setSetupMembers] = useState(["Pai", "Mãe"]);
  const [setupInput, setSetupInput] = useState("");
  const [fIncome, setFIncome] = useState({ source: "", value: "", member: "" });
  const [fExp, setFExp] = useState({ name: "", value: "", cat: CATS[0] });
  const [fCard, setFCard] = useState({ name: "", limit: "" });
  const [fTx, setFTx] = useState({ desc: "", value: "", cat: CATS[0], member: "", type: "debit", card: "", installments: 1, date: new Date().toISOString().slice(0, 10) });

  useEffect(() => { try { const r = localStorage.getItem(STORAGE_KEY); if (r) setData(p => ({ ...p, ...JSON.parse(r) })); } catch(e){} setLoaded(true); }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e){} }, [data, loaded]);

  const notify = (m) => { setToast(m); setTimeout(() => setToast(null), 2500); };
  const up = (p) => setData(d => ({ ...d, ...p }));

  const cMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const txM = data.transactions.filter(t => t.date?.startsWith(cMonth));
  const totalIncome = data.incomes.reduce((a, i) => a + i.value, 0);
  const totalFixed = data.fixedExpenses.reduce((a, e) => a + e.value, 0);
  const totalVar = txM.reduce((a, t) => a + t.value, 0);
  const totalSpent = totalFixed + totalVar;
  const saldo = totalIncome - totalSpent;
  const saveRate = totalIncome > 0 ? (saldo / totalIncome) * 100 : 0;
  const ccUsed = txM.filter(t => t.type === "credit").reduce((a, t) => a + (t.value / (t.installments || 1)), 0);
  const ccLimit = data.creditCards.reduce((a, c) => a + c.limit, 0);

  const hScore = useMemo(() => {
    let s = 50;
    if (saveRate > 20) s += 25; else if (saveRate > 10) s += 15; else if (saveRate > 0) s += 5; else s -= 20;
    if (ccLimit > 0 && ccUsed / ccLimit < 0.3) s += 15; else if (ccLimit > 0 && ccUsed / ccLimit > 0.7) s -= 15;
    if (totalFixed / Math.max(totalIncome, 1) < 0.5) s += 10; else s -= 10;
    return Math.max(0, Math.min(100, s));
  }, [saveRate, ccUsed, ccLimit, totalFixed, totalIncome]);

  const hIdx = hScore >= 80 ? 4 : hScore >= 65 ? 3 : hScore >= 45 ? 2 : hScore >= 25 ? 1 : 0;
  const HL = ["PERIGO", "ATENÇÃO", "OK", "BOM", "EXCELENTE"];
  const HC = ["#DC2626", "#F97316", "#EAB308", "#22C55E", "#10B981"];

  const catData = useMemo(() => {
    const m = {};
    data.fixedExpenses.forEach(e => { m[e.cat || "💳 Outros"] = (m[e.cat || "💳 Outros"] || 0) + e.value; });
    txM.forEach(t => { m[t.cat] = (m[t.cat] || 0) + t.value; });
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [data.fixedExpenses, txM]);

  const memData = useMemo(() => {
    const m = {};
    txM.forEach(t => { const w = t.member || "?"; m[w] = (m[w] || 0) + t.value; });
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [txM]);

  const runAI = async () => {
    if (!data.geminiKey) { setModal("apikey"); return; }
    setAiLoading(true);
    try {
      const ctx = `Família ${data.familyName}, ${data.members.length} membros (${data.members.join(", ")}). Renda: R$${totalIncome}. Fixo: R$${totalFixed}. Variável mês: R$${totalVar}. Saldo: R$${saldo}. Economia: ${saveRate.toFixed(1)}%. Crédito: R$${Math.round(ccUsed)}/${ccLimit}. Score: ${hScore}/100. Categorias: ${catData.map(c=>c.name+":R$"+c.value).join(", ")}. Por membro: ${memData.map(m=>m.name+":R$"+m.value).join(", ")}. Fixos: ${data.fixedExpenses.map(e=>e.name+":R$"+e.value).join(", ")}.`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${data.geminiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: `Você é um consultor financeiro familiar simples e didático. Fale como se explicasse pra alguém que nunca estudou finanças. Use linguagem do dia a dia. Blocos: COMO ESTÁ (3 linhas), CUIDADO (riscos), FAÇA ISSO (3 ações simples). Português BR.\n\nAnálise:\n${ctx}` }] }] }),
      });
      const d = await res.json();
      setAiResult(d?.candidates?.[0]?.content?.parts?.[0]?.text || "Erro. Verifique a chave API.");
    } catch { setAiResult("Falha na conexão. Tente novamente."); }
    setAiLoading(false);
  };

  const Ring = ({ score, size = 110 }) => {
    const r = (size - 12) / 2, c = 2 * Math.PI * r;
    return (
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#27272A" strokeWidth={6}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={HC[hIdx]} strokeWidth={6} strokeDasharray={c} strokeDashoffset={c*(1-score/100)} strokeLinecap="round" style={{transition:"stroke-dashoffset 1s"}}/>
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fill={HC[hIdx]} fontSize={size*0.25} fontWeight={800} fontFamily="'Sora',sans-serif" style={{transform:"rotate(90deg)",transformOrigin:"center"}}>{score}</text>
      </svg>
    );
  };

  const CTip = ({active,payload}) => active && payload?.[0] ? <div style={{background:"#18181B",border:"1px solid #27272A",borderRadius:8,padding:"8px 12px",fontSize:12}}>{payload[0].name}: {fmt(payload[0].value)}</div> : null;

  // ─── STYLES ───
  const B = {
    root:{fontFamily:"'Sora',-apple-system,sans-serif",background:"#09090B",color:"#E4E4E7",minHeight:"100vh",fontSize:13},
    hd:{padding:"20px 24px 14px",borderBottom:"1px solid rgba(34,197,94,0.12)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10},
    tb:{display:"flex",gap:2,background:"#18181B",borderRadius:10,padding:3,flexWrap:"wrap"},
    t:(a)=>({padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:a?600:400,fontFamily:"inherit",color:a?"#09090B":"#71717A",background:a?"linear-gradient(135deg,#22C55E,#D4A84B)":"transparent"}),
    mn:{padding:"20px 24px 40px"},
    cd:{background:"#18181B",borderRadius:14,padding:"18px 20px",border:"1px solid #27272A"},
    cg:(c)=>({background:"#18181B",borderRadius:14,padding:"18px 20px",border:`1px solid ${c}22`,boxShadow:`0 0 30px ${c}08`}),
    g:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14},
    g2:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginTop:16},
    lb:{fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.08em",color:"#71717A",marginBottom:6},
    vl:{fontSize:24,fontWeight:700,letterSpacing:"-0.03em"},
    bt:{padding:"10px 20px",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",background:"linear-gradient(135deg,#22C55E,#D4A84B)",color:"#09090B"},
    bs:{padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit",background:"linear-gradient(135deg,#22C55E,#D4A84B)",color:"#09090B"},
    bg:{padding:"10px 20px",borderRadius:10,border:"1px solid #27272A",cursor:"pointer",fontSize:12,fontWeight:500,fontFamily:"inherit",background:"transparent",color:"#A1A1AA"},
    ip:{padding:"10px 14px",borderRadius:10,border:"1px solid #27272A",background:"#09090B",color:"#E4E4E7",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box",outline:"none"},
    sl:{padding:"10px 14px",borderRadius:10,border:"1px solid #27272A",background:"#09090B",color:"#E4E4E7",fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box",outline:"none"},
    mo:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,backdropFilter:"blur(8px)",padding:16},
    mb:{background:"#18181B",borderRadius:18,padding:"24px",width:"min(92vw,440px)",border:"1px solid #27272A",maxHeight:"85vh",overflowY:"auto"},
    hn:{fontSize:11,color:"#52525B",marginTop:4,lineHeight:1.5},
    dv:{height:1,background:"#1E1E22",margin:"16px 0"},
  };

  // ─── SETUP ───
  if (!data.setupDone) return (
    <div style={B.root}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap'); *{box-sizing:border-box;margin:0;padding:0} input:focus,select:focus{border-color:#22C55E!important}`}</style>
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{maxWidth:480,width:"100%"}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{width:48,height:48,borderRadius:10,background:"linear-gradient(135deg,#22C55E,#D4A84B)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:800,color:"#09090B",margin:"0 auto 12px"}}>F</div>
            <h1 style={{fontSize:28,fontWeight:800,background:"linear-gradient(90deg,#22C55E,#D4A84B)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",margin:0}}>FORTUNA</h1>
            <p style={{color:"#71717A",fontSize:13,marginTop:8}}>Controle financeiro da família</p>
          </div>
          <div style={B.cd}>
            {setupStep===0&&<div>
              <div style={{fontSize:13,fontWeight:600,color:"#A1A1AA",marginBottom:10}}>👋 Qual o sobrenome da família?</div>
              <p style={B.hn}>Só pra personalizar o dashboard. Ex: "Silva"</p>
              <input placeholder="Sobrenome" value={setupFamily} onChange={e=>setSetupFamily(e.target.value)} style={{...B.ip,marginTop:12}}/>
              <button style={{...B.bt,width:"100%",marginTop:16}} onClick={()=>{if(setupFamily.trim())setSetupStep(1)}}>Próximo →</button>
            </div>}
            {setupStep===1&&<div>
              <div style={{fontSize:13,fontWeight:600,color:"#A1A1AA",marginBottom:10}}>👥 Quem faz compras na família?</div>
              <p style={B.hn}>Coloque todos que gastam dinheiro. Assim dá pra saber quem gastou o quê.</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,margin:"12px 0"}}>
                {setupMembers.map((m,i)=><span key={i} style={{padding:"6px 12px",borderRadius:8,background:"#22C55E18",color:"#22C55E",fontSize:12,fontWeight:500,display:"flex",alignItems:"center",gap:6}}>{m}<span onClick={()=>setSetupMembers(p=>p.filter((_,j)=>j!==i))} style={{cursor:"pointer",opacity:0.5}}>×</span></span>)}
              </div>
              <div style={{display:"flex",gap:8}}>
                <input placeholder="Nome (ex: Filho, Avó)" value={setupInput} onChange={e=>setSetupInput(e.target.value)} style={B.ip} onKeyDown={e=>{if(e.key==="Enter"&&setupInput.trim()){setSetupMembers(p=>[...p,setupInput.trim()]);setSetupInput("")}}}/>
                <button style={B.bs} onClick={()=>{if(setupInput.trim()){setSetupMembers(p=>[...p,setupInput.trim()]);setSetupInput("")}}}>+</button>
              </div>
              <div style={{display:"flex",gap:10,marginTop:16}}>
                <button style={B.bg} onClick={()=>setSetupStep(0)}>← Voltar</button>
                <button style={{...B.bt,flex:1}} onClick={()=>setSetupStep(2)}>Próximo →</button>
              </div>
            </div>}
            {setupStep===2&&<div>
              <div style={{fontSize:13,fontWeight:600,color:"#A1A1AA",marginBottom:10}}>✅ Tudo pronto!</div>
              <p style={B.hn}>Família <strong style={{color:"#22C55E"}}>{setupFamily}</strong> com {setupMembers.length} membros: {setupMembers.join(", ")}.</p>
              <p style={{...B.hn,marginTop:8}}>Dentro do dashboard você vai cadastrar: rendas, gastos fixos e cartões. É bem fácil!</p>
              <button style={{...B.bt,width:"100%",marginTop:16}} onClick={()=>up({setupDone:true,familyName:setupFamily.trim(),members:setupMembers})}>🚀 Começar</button>
            </div>}
            <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:20}}>
              {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:4,background:setupStep===i?"#22C55E":"#27272A"}}/>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── MAIN TABS ───
  const Painel = () => (
    <div>
      <div style={B.g}>
        <div style={B.cg("#22C55E")}><div style={B.lb}>💰 Renda Total<Tip text="Soma de todos os salários e rendas cadastrados em Configurar"/></div><div style={{...B.vl,color:"#22C55E"}}>{fmt(totalIncome)}</div></div>
        <div style={B.cg("#DC2626")}><div style={B.lb}>🔴 Total Gasto<Tip text="Fixos (repetem todo mês) + variáveis (compras do dia a dia)"/></div><div style={{...B.vl,color:"#DC2626"}}>{fmt(totalSpent)}</div><div style={B.hn}>Fixo {fmt(totalFixed)} + Variável {fmt(totalVar)}</div></div>
        <div style={B.cg("#D4A84B")}><div style={B.lb}>💛 Sobra<Tip text="O que sobra. Negativo = gastando mais que ganha!"/></div><div style={{...B.vl,color:saldo>=0?"#D4A84B":"#DC2626"}}>{fmt(saldo)}</div><div style={B.hn}>{saveRate>=0?`Guardando ${pct(saveRate)}`:"⚠️ No vermelho"}</div></div>
      </div>
      <div style={B.g2}>
        <div style={{...B.cd,display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 20px"}}>
          <div style={B.lb}>Saúde Financeira<Tip text="0 a 100. Acima de 65 = bom. Abaixo de 45 = cuidado!"/></div>
          <div style={{margin:"10px 0"}}><Ring score={hScore}/></div>
          <span style={{padding:"4px 14px",borderRadius:6,fontSize:12,fontWeight:600,background:`${HC[hIdx]}18`,color:HC[hIdx]}}>{HL[hIdx]}</span>
        </div>
        <div style={B.cd}>
          <div style={B.lb}>Por Categoria</div>
          {catData.length>0?<ResponsiveContainer width="100%" height={200}><PieChart><Pie data={catData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">{catData.map((_,i)=><Cell key={i} fill={CAT_COLORS[i%CAT_COLORS.length]}/>)}</Pie><Tooltip content={<CTip/>}/></PieChart></ResponsiveContainer>:<div style={{textAlign:"center",padding:40,color:"#3F3F46"}}>Cadastre gastos pra ver o gráfico</div>}
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>{catData.map((c,i)=><span key={i} style={{fontSize:10,color:"#A1A1AA",display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:CAT_COLORS[i%CAT_COLORS.length]}}/>{c.name}</span>)}</div>
        </div>
      </div>
      {data.creditCards.length>0&&<div style={{...B.cd,marginTop:16}}>
        <div style={B.lb}>💳 Cartões de Crédito</div>
        {data.creditCards.map(c=>{const used=txM.filter(t=>t.type==="credit"&&t.card===c.id).reduce((a,t)=>a+(t.value/(t.installments||1)),0);const p=c.limit>0?used/c.limit*100:0;return(
          <div key={c.id} style={{padding:"12px 0",borderBottom:"1px solid #1E1E22"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontWeight:500}}>{c.name}</span><span style={{color:p>80?"#DC2626":"#A1A1AA",fontWeight:600}}>{fmt(used)} / {fmt(c.limit)}</span></div>
            <div style={{height:6,borderRadius:3,background:"#27272A",overflow:"hidden"}}><div style={{height:"100%",borderRadius:3,width:`${Math.min(p,100)}%`,background:p>80?"#DC2626":p>50?"#EAB308":"#22C55E",transition:"width 0.5s"}}/></div>
            <div style={B.hn}>{pct(p)} usado{p>80?" — ⚠️ Quase no limite!":""}</div>
          </div>
        )})}
      </div>}
    </div>
  );

  const Gastos = () => (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div><div style={B.lb}>Gastos do Mês</div><div style={{...B.vl,color:totalVar>0?"#DC2626":"#71717A",fontSize:20}}>{fmt(totalVar)}</div></div>
        <button style={B.bt} onClick={()=>setModal("tx")}>+ Registrar Gasto</button>
      </div>
      {txM.length===0?<div style={{...B.cd,textAlign:"center",padding:"40px 20px",color:"#3F3F46"}}><div style={{fontSize:32,marginBottom:8}}>📝</div>Nenhum gasto registrado neste mês<div style={B.hn}>Toque em "+ Registrar Gasto" pra começar</div></div>
      :<div style={B.cd}>{txM.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(t=>(
        <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid #1E1E22"}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:500}}>{t.desc}</div>
            <div style={{fontSize:10,color:"#52525B"}}>{t.cat} · {t.member||"?"} · {t.type==="credit"?`💳 ${t.installments}x`:"💵 Débito"} · {new Date(t.date+"T12:00").toLocaleDateString("pt-BR")}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontWeight:600,color:"#DC2626"}}>{fmt(t.value)}</span>
            <button onClick={()=>up({transactions:data.transactions.filter(x=>x.id!==t.id)})} style={{background:"none",border:"none",color:"#3F3F46",cursor:"pointer",fontSize:14}}>×</button>
          </div>
        </div>
      ))}</div>}
      {memData.length>0&&<div style={{...B.cd,marginTop:16}}>
        <div style={B.lb}>Quem Gastou Mais<Tip text="Mostra quanto cada pessoa da família gastou neste mês"/></div>
        <ResponsiveContainer width="100%" height={150}><BarChart data={memData} margin={{top:10,right:10,left:-20,bottom:0}}><XAxis dataKey="name" tick={{fill:"#71717A",fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#71717A",fontSize:10}} axisLine={false} tickLine={false}/><Tooltip content={<CTip/>}/><Bar dataKey="value" fill="#D4A84B" radius={[4,4,0,0]} name="Gasto"/></BarChart></ResponsiveContainer>
      </div>}
    </div>
  );

  const Config = () => (
    <div>
      <div style={B.cd}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={B.lb}>💰 Rendas Mensais<Tip text="Cadastre todos os salários e rendas da família"/></div><button style={B.bs} onClick={()=>setModal("income")}>+ Renda</button></div>
        {data.incomes.length===0?<div style={{...B.hn,textAlign:"center",padding:20}}>Nenhuma renda cadastrada ainda</div>
        :data.incomes.map(i=>(
          <div key={i.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #1E1E22"}}>
            <div><div style={{fontWeight:500}}>{i.source}</div><div style={{fontSize:10,color:"#52525B"}}>{i.member||"Família"}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:600,color:"#22C55E"}}>{fmt(i.value)}</span><button onClick={()=>up({incomes:data.incomes.filter(x=>x.id!==i.id)})} style={{background:"none",border:"none",color:"#3F3F46",cursor:"pointer",fontSize:14}}>×</button></div>
          </div>
        ))}
      </div>
      <div style={{...B.cd,marginTop:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={B.lb}>🔴 Gastos Fixos<Tip text="Gastos que se repetem todo mês: aluguel, luz, água, internet, etc."/></div><button style={B.bs} onClick={()=>setModal("fixed")}>+ Gasto Fixo</button></div>
        {data.fixedExpenses.length===0?<div style={{...B.hn,textAlign:"center",padding:20}}>Nenhum gasto fixo cadastrado</div>
        :data.fixedExpenses.map(e=>(
          <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #1E1E22"}}>
            <div><div style={{fontWeight:500}}>{e.name}</div><div style={{fontSize:10,color:"#52525B"}}>{e.cat}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:600,color:"#DC2626"}}>{fmt(e.value)}</span><button onClick={()=>up({fixedExpenses:data.fixedExpenses.filter(x=>x.id!==e.id)})} style={{background:"none",border:"none",color:"#3F3F46",cursor:"pointer",fontSize:14}}>×</button></div>
          </div>
        ))}
        {data.fixedExpenses.length>0&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:8,background:"#DC262610"}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,fontWeight:600,color:"#DC2626"}}>Total Fixo</span><span style={{fontWeight:700,color:"#DC2626"}}>{fmt(totalFixed)}</span></div></div>}
      </div>
      <div style={{...B.cd,marginTop:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={B.lb}>💳 Cartões de Crédito<Tip text="Cadastre cada cartão com seu limite. Assim dá pra controlar quanto já usou."/></div><button style={B.bs} onClick={()=>setModal("card")}>+ Cartão</button></div>
        {data.creditCards.length===0?<div style={{...B.hn,textAlign:"center",padding:20}}>Nenhum cartão cadastrado</div>
        :data.creditCards.map(c=>(
          <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #1E1E22"}}>
            <span style={{fontWeight:500}}>{c.name}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:600,color:"#A1A1AA"}}>Limite: {fmt(c.limit)}</span><button onClick={()=>up({creditCards:data.creditCards.filter(x=>x.id!==c.id)})} style={{background:"none",border:"none",color:"#3F3F46",cursor:"pointer",fontSize:14}}>×</button></div>
          </div>
        ))}
      </div>
      <div style={{...B.cd,marginTop:16}}>
        <div style={B.lb}>🤖 Chave da IA (Gemini)<Tip text="Pegue gratuitamente em aistudio.google.com/apikey. Cole aqui. A IA analisa suas finanças e dá dicas."/></div>
        <input type="password" placeholder="Cole sua chave aqui" value={data.geminiKey} onChange={e=>up({geminiKey:e.target.value})} style={B.ip}/>
        <div style={B.hn}>Sua chave fica salva apenas no seu aparelho. Ninguém mais tem acesso.</div>
      </div>
      <div style={{...B.cd,marginTop:16,border:"1px solid #DC262630"}}>
        <div style={B.lb}>⚠️ Resetar Tudo</div>
        <p style={B.hn}>Apaga todos os dados e volta pro início.</p>
        <button style={{padding:"8px 16px",borderRadius:8,border:"1px solid #DC262630",cursor:"pointer",fontSize:12,fontWeight:500,fontFamily:"inherit",background:"#DC262610",color:"#DC2626",marginTop:8}} onClick={()=>{if(confirm("Tem certeza? Todos os dados serão apagados!")){localStorage.removeItem(STORAGE_KEY);setData(EMPTY);}}}>Resetar</button>
      </div>
    </div>
  );

  const IA = () => (
    <div>
      <div style={B.cg("#22C55E")}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#22C55E,#D4A84B)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🤖</div>
          <div><div style={{fontSize:14,fontWeight:700}}>Consultor IA da Família</div><div style={{fontSize:10,color:"#71717A"}}>Analisa seus dados e dá dicas simples</div></div>
        </div>
        {!data.geminiKey?<div><p style={{...B.hn,marginBottom:12}}>Pra usar a IA, cadastre sua chave gratuita do Gemini na aba <strong style={{color:"#22C55E"}}>Configurar</strong>.</p><button style={B.bt} onClick={()=>{setTab("config");setModal("apikey")}}>Ir para Configurar</button></div>
        :<button onClick={runAI} disabled={aiLoading} style={{...B.bt,width:"100%",opacity:aiLoading?0.5:1,padding:"14px 20px"}}>{aiLoading?"Analisando...":"Rodar Análise da Família"}</button>}
        {aiResult&&<div style={{marginTop:20,padding:20,borderRadius:12,background:"#09090B",border:"1px solid #27272A",fontSize:13,lineHeight:1.8,color:"#D4D4D8",whiteSpace:"pre-wrap"}}>{aiResult}</div>}
      </div>
    </div>
  );

  // ─── MODALS ───
  const Modal = ({title,children}) => (
    <div style={B.mo} onClick={()=>setModal(null)}><div style={B.mb} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:20}}>{title}</div>{children}
    </div></div>
  );

  return (
    <div style={B.root}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap'); *{box-sizing:border-box;margin:0;padding:0} input:focus,select:focus{border-color:#22C55E!important} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#27272A;border-radius:2px}`}</style>

      <header style={B.hd}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#22C55E,#D4A84B)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#09090B"}}>F</div>
          <span style={{fontSize:18,fontWeight:700,letterSpacing:"-0.03em",background:"linear-gradient(90deg,#22C55E,#D4A84B)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>FORTUNA</span>
          <span style={{fontSize:11,color:"#3F3F46",fontWeight:400}}>Família {data.familyName}</span>
        </div>
        <nav style={B.tb}>
          {[["painel","📊 Painel"],["gastos","💸 Gastos"],["ia","🤖 IA"],["config","⚙️ Configurar"]].map(([k,v])=><button key={k} style={B.t(tab===k)} onClick={()=>setTab(k)}>{v}</button>)}
        </nav>
      </header>

      <main style={B.mn}>
        {tab==="painel"&&<Painel/>}
        {tab==="gastos"&&<Gastos/>}
        {tab==="ia"&&<IA/>}
        {tab==="config"&&<Config/>}
      </main>

      {modal==="income"&&<Modal title="Adicionar Renda"><div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><div style={B.lb}>De onde vem o dinheiro?</div><input placeholder="Ex: Salário, Freelance, Aluguel..." value={fIncome.source} onChange={e=>setFIncome(p=>({...p,source:e.target.value}))} style={B.ip}/></div>
        <div><div style={B.lb}>Quanto por mês?</div><input type="number" placeholder="R$" value={fIncome.value} onChange={e=>setFIncome(p=>({...p,value:e.target.value}))} style={B.ip}/></div>
        <div><div style={B.lb}>De quem?</div><select value={fIncome.member} onChange={e=>setFIncome(p=>({...p,member:e.target.value}))} style={B.sl}><option value="">Família toda</option>{data.members.map(m=><option key={m}>{m}</option>)}</select></div>
        <div style={{display:"flex",gap:10,marginTop:8}}><button style={B.bt} onClick={()=>{if(fIncome.source&&fIncome.value){up({incomes:[...data.incomes,{id:uid(),source:fIncome.source,value:parseFloat(fIncome.value),member:fIncome.member}]});setFIncome({source:"",value:"",member:""});setModal(null);notify("Renda adicionada")}}}>Salvar</button><button style={B.bg} onClick={()=>setModal(null)}>Cancelar</button></div>
      </div></Modal>}

      {modal==="fixed"&&<Modal title="Adicionar Gasto Fixo"><div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><div style={B.lb}>O que é?</div><input placeholder="Ex: Aluguel, Luz, Internet..." value={fExp.name} onChange={e=>setFExp(p=>({...p,name:e.target.value}))} style={B.ip}/></div>
        <div><div style={B.lb}>Quanto por mês?</div><input type="number" placeholder="R$" value={fExp.value} onChange={e=>setFExp(p=>({...p,value:e.target.value}))} style={B.ip}/></div>
        <div><div style={B.lb}>Categoria</div><select value={fExp.cat} onChange={e=>setFExp(p=>({...p,cat:e.target.value}))} style={B.sl}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
        <div style={{display:"flex",gap:10,marginTop:8}}><button style={B.bt} onClick={()=>{if(fExp.name&&fExp.value){up({fixedExpenses:[...data.fixedExpenses,{id:uid(),name:fExp.name,value:parseFloat(fExp.value),cat:fExp.cat}]});setFExp({name:"",value:"",cat:CATS[0]});setModal(null);notify("Gasto fixo adicionado")}}}>Salvar</button><button style={B.bg} onClick={()=>setModal(null)}>Cancelar</button></div>
      </div></Modal>}

      {modal==="card"&&<Modal title="Adicionar Cartão"><div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><div style={B.lb}>Nome do cartão</div><input placeholder="Ex: Nubank, Itaú, BB..." value={fCard.name} onChange={e=>setFCard(p=>({...p,name:e.target.value}))} style={B.ip}/></div>
        <div><div style={B.lb}>Limite total</div><input type="number" placeholder="R$" value={fCard.limit} onChange={e=>setFCard(p=>({...p,limit:e.target.value}))} style={B.ip}/></div>
        <div style={{display:"flex",gap:10,marginTop:8}}><button style={B.bt} onClick={()=>{if(fCard.name&&fCard.limit){up({creditCards:[...data.creditCards,{id:uid(),name:fCard.name,limit:parseFloat(fCard.limit)}]});setFCard({name:"",limit:""});setModal(null);notify("Cartão adicionado")}}}>Salvar</button><button style={B.bg} onClick={()=>setModal(null)}>Cancelar</button></div>
      </div></Modal>}

      {modal==="tx"&&<Modal title="Registrar Gasto"><div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><div style={B.lb}>O que comprou?</div><input placeholder="Ex: Gasolina, Mercado, Farmácia..." value={fTx.desc} onChange={e=>setFTx(p=>({...p,desc:e.target.value}))} style={B.ip}/></div>
        <div><div style={B.lb}>Quanto?</div><input type="number" placeholder="R$" value={fTx.value} onChange={e=>setFTx(p=>({...p,value:e.target.value}))} style={B.ip}/></div>
        <div><div style={B.lb}>Categoria</div><select value={fTx.cat} onChange={e=>setFTx(p=>({...p,cat:e.target.value}))} style={B.sl}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div>
        <div><div style={B.lb}>Quem comprou?</div><select value={fTx.member} onChange={e=>setFTx(p=>({...p,member:e.target.value}))} style={B.sl}><option value="">Selecione</option>{data.members.map(m=><option key={m}>{m}</option>)}</select></div>
        <div><div style={B.lb}>Pagou como?<Tip text="Débito = saiu do saldo na hora. Crédito = vai pra fatura do cartão."/></div><select value={fTx.type} onChange={e=>setFTx(p=>({...p,type:e.target.value}))} style={B.sl}><option value="debit">💵 Débito / Dinheiro / Pix</option><option value="credit">💳 Cartão de Crédito</option></select></div>
        {fTx.type==="credit"&&<>
          <div><div style={B.lb}>Qual cartão?</div><select value={fTx.card} onChange={e=>setFTx(p=>({...p,card:e.target.value}))} style={B.sl}><option value="">Selecione</option>{data.creditCards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><div style={B.lb}>Parcelas</div><input type="number" min={1} max={48} value={fTx.installments} onChange={e=>setFTx(p=>({...p,installments:e.target.value}))} style={B.ip}/></div>
          {fTx.value&&fTx.installments>1&&<div style={{padding:"8px 12px",borderRadius:8,background:"#D4A84B10",fontSize:11,color:"#D4A84B"}}>{parseInt(fTx.installments)}x de {fmt(parseFloat(fTx.value)/parseInt(fTx.installments||1))}</div>}
        </>}
        <div><div style={B.lb}>Data</div><input type="date" value={fTx.date} onChange={e=>setFTx(p=>({...p,date:e.target.value}))} style={B.ip}/></div>
        <div style={{display:"flex",gap:10,marginTop:8}}><button style={B.bt} onClick={()=>{if(fTx.desc&&fTx.value){up({transactions:[...data.transactions,{...fTx,id:uid(),value:parseFloat(fTx.value),installments:parseInt(fTx.installments)||1}]});setFTx({desc:"",value:"",cat:CATS[0],member:data.members[0]||"",type:"debit",card:"",installments:1,date:new Date().toISOString().slice(0,10)});setModal(null);notify("Gasto registrado")}}}>Salvar</button><button style={B.bg} onClick={()=>setModal(null)}>Cancelar</button></div>
      </div></Modal>}

      {toast&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#22C55E",color:"#09090B",padding:"10px 24px",borderRadius:10,fontSize:13,fontWeight:600,fontFamily:"inherit",zIndex:9999}}>{toast}</div>}
    </div>
  );
}
