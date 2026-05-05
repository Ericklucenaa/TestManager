import React, { useState, useEffect, createContext, useContext } from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';

// --- Storage & Context ---
const STORAGE_KEY = 'test_manager_v5';

const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {
      projects: [{ id: '1', name: 'Nexus Core', environment: 'Production', description: 'Sistema Principal' }],
      requirements: [{ id: 'req_1', code: 'REQ-01', title: 'Autenticação', description: 'Login Seguro' }],
      testCases: [
        { 
          id: 'tc_1', 
          requirementId: 'req_1', 
          title: 'Validar Login Admin', 
          priority: 'Alta', 
          status: 'Não executado',
          steps: [
            { action: 'Digitar user admin', expected: 'Campo preenchido', status: 'pending', testData: '', actualResult: '', requirementRuleMet: '' },
            { action: 'Digitar senha 123', expected: 'Campo oculto', status: 'pending', testData: '', actualResult: '', requirementRuleMet: '' },
            { action: 'Clicar Entrar', expected: 'Dashboard visível', status: 'pending', testData: '', actualResult: '', requirementRuleMet: '' }
          ]
        }
      ],
      bugs: [],
      auditLogs: [],
      sessions: [],
      theme: 'dark',
      currentExecutionInfo: { ticketRef: '', responsible: '', date: new Date().toISOString().split('T')[0], environment: '' },
      user: null
    };
  });

  const [currentView, setCurrentView] = useState('dashboard');
  const [viewParams, setViewParams] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const logAction = (action, targetId) => {
    const log = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), userName: state.user?.name || 'Sistema', action, targetId };
    setState(s => ({ ...s, auditLogs: [log, ...s.auditLogs] }));
  };

  const deleteItem = (type, id) => {
    setState(s => {
      const newState = { ...s, [type]: s[type].filter(item => item.id !== id) };
      if (type === 'requirements') {
        const deletedTestCases = s.testCases.filter(tc => tc.requirementId === id);
        const deletedTcIds = new Set(deletedTestCases.map(tc => tc.id));
        newState.testCases = s.testCases.filter(tc => tc.requirementId !== id);
        newState.bugs = s.bugs.filter(b => !deletedTcIds.has(b.caseId));
      } else if (type === 'testCases') {
        newState.bugs = s.bugs.filter(b => b.caseId !== id);
      }
      return newState;
    });
    logAction(`Excluiu de ${type}`, id);
  };

  const updateExecutionInfo = (field, value) => {
    setState(s => ({
      ...s,
      currentExecutionInfo: { ...s.currentExecutionInfo, [field]: value }
    }));
  };

  const value = {
    state, setState, currentView, setCurrentView, viewParams, setViewParams,
    searchQuery, setSearchQuery, isSidebarOpen, setSidebarOpen, logAction, deleteItem,
    updateExecutionInfo
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

const useApp = () => useContext(AppContext);

// --- UI Components ---

const Badge = ({ type, children }) => {
  const variant = { 
    Alta: 'badge-danger', Média: 'badge-warning', Baixa: 'badge-info', 
    Aprovado: 'badge-success', Reprovado: 'badge-danger', 'Não executado': 'badge-secondary',
    Aberto: 'badge-danger', Corrigido: 'badge-success'
  }[children] || 'badge-secondary';
  return <span className={`badge ${variant}`}>{children}</span>;
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn" onClick={onClose} style={{ padding: '0.4rem', background: 'transparent' }}><i className="ph ph-x"></i></button>
        </div>
        {children}
      </div>
    </div>
  );
};

// --- View: Dashboard ---
const Dashboard = () => {
  const { state } = useApp();
  return (
    <div className="animate-fade">
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h4 style={{ color: 'var(--text-secondary)' }}>CASOS DE TESTE</h4>
            <i className="ph ph-test-tube" style={{ color: 'var(--accent-primary)' }}></i>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '0.5rem' }}>{state.testCases.length}</div>
        </div>
        <div className="stat-card">
           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h4 style={{ color: 'var(--text-secondary)' }}>BUGS ATIVOS</h4>
            <i className="ph ph-bug-beetle" style={{ color: 'var(--accent-danger)' }}></i>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--accent-danger)' }}>{state.bugs.filter(b => b.status === 'Aberto').length}</div>
        </div>
        <div className="stat-card">
           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h4 style={{ color: 'var(--text-secondary)' }}>TICKETS</h4>
            <i className="ph ph-ticket" style={{ color: 'var(--accent-info)' }}></i>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '0.5rem' }}>{state.requirements.length}</div>
        </div>
      </div>
      
      <div className="stat-card">
        <h3>Logs de Auditoria</h3>
        <div style={{ marginTop: '1.5rem' }}>
          {state.auditLogs.slice(0, 8).map(log => (
            <div key={log.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                 <span style={{ fontWeight: 600 }}>{log.userName}</span> <span style={{ opacity: 0.8 }}>{log.action}</span>
                 <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>UUID: {log.targetId}</div>
               </div>
               <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{new Date(log.timestamp).toLocaleTimeString()}</div>
            </div>
          ))}
          {state.auditLogs.length === 0 && <p style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Sem atividades recentes.</p>}
        </div>
      </div>
    </div>
  );
};

// --- View: Requirements ---
const Requirements = () => {
  const { state, setState, searchQuery, deleteItem, logAction } = useApp();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ code: '', title: '', description: '' });

  const filtered = state.requirements.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.code.toLowerCase().includes(searchQuery.toLowerCase()));

  const save = (e) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    setState(s => ({ ...s, requirements: [...s.requirements, { ...form, id }] }));
    logAction('Criou Ticket', id);
    setModal(false);
    setForm({ code: '', title: '', description: '' });
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h3>Mapeamento de Tickets</h3>
        <button className="btn btn-primary" onClick={() => setModal(true)}><i className="ph ph-plus"></i> Novo Ticket</button>
      </div>
      <div className="stat-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Código</th><th>Título</th><th>Descrição</th><th style={{ textAlign: 'right' }}>Ações</th></tr></thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 900, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>{r.code}</td>
                <td style={{ fontWeight: 600 }}>{r.title}</td>
                <td style={{ fontSize: '0.85rem', opacity: 0.7 }}>{r.description}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-danger" onClick={() => deleteItem('requirements', r.id)} style={{ padding: '0.5rem' }}><i className="ph ph-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Novo Ticket">
        <form onSubmit={save}>
          <div className="form-group"><label className="form-label">Código</label><input className="form-input" required value={form.code} onChange={e => setForm({...form, code: e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Título</label><input className="form-input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Descrição</label><textarea className="form-textarea" rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" className="btn" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// --- View: TestCases ---
const TestCases = () => {
  const { state, setState, searchQuery, deleteItem, logAction, setCurrentView, setViewParams } = useApp();
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', requirementId: '', priority: 'Média', steps: [{ action: '', expected: '', status: 'pending', testData: '', actualResult: '', requirementRuleMet: '' }] });

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [ticketFilter, setTicketFilter] = useState('');
  const [expandedTickets, setExpandedTickets] = useState({});

  const toggleTicket = (ticketId) => setExpandedTickets(prev => ({ ...prev, [ticketId]: !prev[ticketId] }));

  const filtered = state.testCases.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (ticketFilter === '' || t.requirementId === ticketFilter)
  );

  const groupedTestCases = {};
  filtered.forEach(tc => {
    const key = tc.requirementId || 'unlinked';
    if (!groupedTestCases[key]) groupedTestCases[key] = [];
    groupedTestCases[key].push(tc);
  });

  const addStep = () => setForm({...form, steps: [...form.steps, { action: '', expected: '', status: 'pending', testData: '', actualResult: '', requirementRuleMet: '' }]});

  const openNew = () => {
    setEditingId(null);
    setForm({ title: '', requirementId: '', priority: 'Média', steps: [{ action: '', expected: '', status: 'pending', testData: '', actualResult: '', requirementRuleMet: '' }] });
    setModal(true);
  };

  const openEdit = (tc) => {
    setEditingId(tc.id);
    setForm({ title: tc.title, requirementId: tc.requirementId, priority: tc.priority, steps: JSON.parse(JSON.stringify(tc.steps)) });
    setModal(true);
  };

  const save = (e) => {
    e.preventDefault();
    if (editingId) {
      setState(s => {
        const newTCs = [...s.testCases];
        const idx = newTCs.findIndex(t => t.id === editingId);
        newTCs[idx] = { ...newTCs[idx], ...form };
        return { ...s, testCases: newTCs };
      });
      logAction('Editou Caso de Teste', editingId);
    } else {
      const id = crypto.randomUUID();
      setState(s => ({ ...s, testCases: [...s.testCases, { ...form, id, status: 'Não executado' }] }));
      logAction('Criou Caso de Teste', id);
    }
    setModal(false);
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        <span style={{ cursor: 'pointer' }} onClick={() => setCurrentView('dashboard')}>Dashboard</span>
        <i className="ph ph-caret-right"></i>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Requisitos</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
        <h3>Requisitos</h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select className="form-select" value={ticketFilter} onChange={e => setTicketFilter(e.target.value)}>
            <option value="">Todos os Tickets</option>
            {state.requirements.map(r => <option key={r.id} value={r.id}>{r.code} - {r.title}</option>)}
          </select>
          <button className="btn btn-primary" onClick={openNew}><i className="ph ph-plus"></i> Novo CT</button>
        </div>
      </div>
      <div className="stat-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>Ticket</th>
              <th style={{ textAlign: 'center' }}>Título</th>
              <th style={{ textAlign: 'center' }}>Prioridade</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(groupedTestCases).map(ticketId => {
               const ticket = state.requirements.find(r => r.id === ticketId);
               const ticketName = ticket ? `${ticket.code} - ${ticket.title}` : 'Sem Ticket Vinculado';
               const isExpanded = expandedTickets[ticketId];
               return (
                 <React.Fragment key={ticketId}>
                   <tr style={{ cursor: 'pointer', background: 'var(--accent-secondary)', color: 'white', fontWeight: 'bold' }} onClick={() => toggleTicket(ticketId)}>
                     <td colSpan="5" style={{ padding: '0.5rem', textAlign: 'left' }}>
                       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                         <i className={`ph ph-caret-${isExpanded ? 'down' : 'right'}`}></i>
                         {ticketName} ({groupedTestCases[ticketId].length})
                       </div>
                     </td>
                   </tr>
                   {isExpanded && groupedTestCases[ticketId].map(t => (
                     <tr key={t.id}>
                       <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--accent-primary)' }}>{ticket ? ticket.code : '-'}</td>
                       <td style={{ textAlign: 'center', fontWeight: 600 }}>{t.title}</td>
                       <td style={{ textAlign: 'center' }}><Badge>{t.priority}</Badge></td>
                       <td style={{ textAlign: 'center' }}><Badge>{t.status}</Badge></td>
                       <td style={{ textAlign: 'center' }}>
                         <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                           <button className="btn" onClick={() => openEdit(t)} style={{ padding: '0.5rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)' }} title="Editar"><i className="ph ph-pencil"></i></button>
                           <button className="btn btn-primary" onClick={() => { setViewParams(t.id); setCurrentView('runner'); }} style={{ padding: '0.5rem' }} title="Executar"><i className="ph ph-play"></i></button>
                           <button className="btn btn-danger" onClick={() => setDeleteConfirm(t.id)} style={{ padding: '0.5rem' }} title="Excluir"><i className="ph ph-trash"></i></button>
                         </div>
                       </td>
                     </tr>
                   ))}
                 </React.Fragment>
               );
            })}
          </tbody>
        </table>
      </div>
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editingId ? "Editar Caso de Teste" : "Novo Caso de Teste"}>
        <form onSubmit={save}>
          <div className="form-group"><label className="form-label">Título</label><input className="form-input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div className="form-group">
            <label className="form-label">Prioridade</label>
            <select className="form-select" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
              <option>Alta</option><option>Média</option><option>Baixa</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Vincular Ticket</label>
            <select className="form-select" value={form.requirementId} onChange={e => setForm({...form, requirementId: e.target.value})}>
              <option value="">Nenhum</option>
              {state.requirements.map(r => <option key={r.id} value={r.id}>{r.code} - {r.title}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Passos do Teste</label>
            {form.steps.map((st, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input className="form-input" placeholder="Ação" value={st.action} onChange={e => { const steps = [...form.steps]; steps[i].action = e.target.value; setForm({...form, steps}); }} />
                <input className="form-input" placeholder="Esperado" value={st.expected} onChange={e => { const steps = [...form.steps]; steps[i].expected = e.target.value; setForm({...form, steps}); }} />
                <button type="button" className="btn btn-danger" onClick={() => { const steps = form.steps.filter((_, idx) => idx !== i); setForm({...form, steps}); }} style={{ padding: '0.5rem' }} title="Remover Passo"><i className="ph ph-trash"></i></button>
              </div>
            ))}
            <button type="button" className="btn" onClick={addStep} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>+ Passo</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button type="button" className="btn" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{editingId ? "Atualizar CT" : "Salvar CT"}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmar Exclusão">
        <p>Tem certeza que deseja excluir este requisito?</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button type="button" className="btn" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={() => { deleteItem('testCases', deleteConfirm); setDeleteConfirm(null); }}>Excluir</button>
        </div>
      </Modal>
    </div>
  );
};

// --- View: Execution Runner ---
const Runner = () => {
  const { state, setState, viewParams, setCurrentView, logAction } = useApp();
  const tc = state.testCases.find(t => t.id === viewParams);
  
  if (!tc) return <div>CT não encontrado.</div>;

  const updateStep = (idx, status) => {
    setState(s => {
      const tcIdx = s.testCases.findIndex(t => t.id === tc.id);
      const newTCs = [...s.testCases];
      newTCs[tcIdx].steps[idx].status = status;
      return { ...s, testCases: newTCs };
    });
  };

  const finish = () => {
    const hasFail = tc.steps.some(s => s.status === 'failed');
    const allPass = tc.steps.every(s => s.status === 'passed');
    const finalStatus = allPass ? 'Aprovado' : hasFail ? 'Reprovado' : 'Parcial';
    
    setState(s => {
      const tcIdx = s.testCases.findIndex(t => t.id === tc.id);
      const newTCs = [...s.testCases];
      newTCs[tcIdx].status = finalStatus;
      
      let newBugs = [...s.bugs];
      if (hasFail) {
        const bugId = crypto.randomUUID();
        newBugs = [{ id: bugId, caseId: tc.id, title: `Falha: ${tc.title}`, status: 'Aberto', severity: 'Alta' }, ...newBugs];
        logAction('Bug Automático detectado', bugId);
      }
      
      return { ...s, testCases: newTCs, bugs: newBugs };
    });
    
    logAction('Execução finalizada', tc.id);
    setCurrentView('testCases');
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        <span style={{ cursor: 'pointer' }} onClick={() => setCurrentView('testCases')}>Requisitos</span>
        <i className="ph ph-caret-right"></i>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Execução</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h3>Execução: {tc.title}</h3>
          <p style={{ opacity: 0.5 }}>Ticket: {state.requirements.find(r => r.id === tc.requirementId)?.code || 'N/A'}</p>
        </div>
        <button className="btn" onClick={() => setCurrentView('testCases')}>Sair</button>
      </div>
      
      <div style={{ maxWidth: '800px' }}>
        {tc.steps.map((st, i) => (
          <div key={i} className="stat-card" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>Passo {i+1}: {st.action}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Esperado: {st.expected}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn" onClick={() => updateStep(i, 'passed')} style={{ background: st.status === 'passed' ? 'var(--accent-success)' : 'transparent', border: '1px solid var(--accent-success)' }}><i className="ph ph-check"></i></button>
              <button className="btn" onClick={() => updateStep(i, 'failed')} style={{ background: st.status === 'failed' ? 'var(--accent-danger)' : 'transparent', border: '1px solid var(--accent-danger)' }}><i className="ph ph-x"></i></button>
            </div>
          </div>
        ))}
        <button className="btn btn-primary" onClick={finish} style={{ width: '100%', padding: '1.25rem', marginTop: '1rem' }}>Finalizar Execução</button>
      </div>
    </div>
  );
};

// --- View: Bugs ---
const Bugs = () => {
  const { state, deleteItem } = useApp();
  return (
    <div className="animate-fade">
      <h3>Central de Bugs</h3>
      <div className="stat-card" style={{ padding: 0, marginTop: '2rem' }}>
        <table className="data-table">
          <thead><tr><th>ID</th><th>Título</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {state.bugs.map(b => (
              <tr key={b.id}>
                <td style={{ fontSize: '0.75rem', opacity: 0.5 }}>{b.id.substring(0,8)}</td>
                <td style={{ fontWeight: 600 }}>{b.title}</td>
                <td><Badge>{b.status}</Badge></td>
                <td><button className="btn btn-danger" onClick={() => deleteItem('bugs', b.id)}><i className="ph ph-trash"></i></button></td>
              </tr>
            ))}
            {state.bugs.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>Nenhum bug encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- View: SpreadsheetView ---
const SpreadsheetView = () => {
  const { state, setState, updateExecutionInfo } = useApp();
  const { currentExecutionInfo } = state;

  let allSteps = [];
  state.testCases.forEach(tc => {
    tc.steps.forEach((st, i) => {
      allSteps.push({
        tcId: tc.id,
        tcTitle: i === 0 ? tc.title : '',
        stepIdx: i,
        step: st
      });
    });
  });

  const updateStepStatus = (tcId, stepIdx, field, value) => {
    setState(s => {
      const newTCs = [...s.testCases];
      const tcIndex = newTCs.findIndex(t => t.id === tcId);
      newTCs[tcIndex].steps[stepIdx][field] = value;
      return { ...s, testCases: newTCs };
    });
  };

  const totalSteps = allSteps.length;
  const ok = allSteps.filter(s => s.step.status === 'passed').length;
  const falha = allSteps.filter(s => s.step.status === 'failed').length;
  const pendente = allSteps.filter(s => s.step.status === 'pending').length;
  const taxaSuccess = totalSteps > 0 ? ((ok / totalSteps) * 100).toFixed(2) : 0;

  const noData = totalSteps === 0;
  const okDeg = noData ? 0 : (ok / totalSteps) * 360;
  const falhaDeg = noData ? 0 : okDeg + (falha / totalSteps) * 360;

  const pieBg = noData 
     ? 'conic-gradient(#e2e8f0 0deg, #e2e8f0 360deg)' 
     : `conic-gradient(#10b981 0deg ${okDeg}deg, #ef4444 ${okDeg}deg ${falhaDeg}deg, #f59e0b ${falhaDeg}deg 360deg)`;

  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="animate-fade spreadsheet-container" style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: '1rem', fontFamily: 'Arial, sans-serif' }}>
       {/* Spreadsheet Area */}
       <div className="spreadsheet-table-wrapper" style={{ flex: 1, overflow: 'auto', background: '#fff', borderRadius: '4px', border: '1px solid #ccc', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid #ccc' }}>
            <button className="btn btn-primary" onClick={exportPDF}><i className="ph ph-printer"></i> Exportar PDF</button>
          </div>
          <div className="spreadsheet-table-inner" style={{ overflow: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', minWidth: '900px' }}>
              <thead style={{ background: 'var(--accent-primary)', color: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
                 <tr>
                 <th style={{ border: '1px solid #ccc', padding: '6px 8px', width: '50px', textAlign: 'center' }}>STEPS</th>
                 <th style={{ border: '1px solid #ccc', padding: '6px 8px' }}>Título do Caso de Teste</th>
                 <th style={{ border: '1px solid #ccc', padding: '6px 8px', width: '20%' }}>Passos de Execução</th>
                 <th style={{ border: '1px solid #ccc', padding: '6px 8px', width: '15%' }}>Resultado Esperado</th>
                 <th style={{ border: '1px solid #ccc', padding: '6px 8px', width: '15%' }}>Resultado Atual</th>
                 <th style={{ border: '1px solid #ccc', padding: '6px 8px', width: '100px' }}>Status</th>
               </tr>
            </thead>
            <tbody>
              {allSteps.map((row, index) => {
                 const isPendente = row.step.status === 'pending';
                 const isOk = row.step.status === 'passed';
                 const isFalha = row.step.status === 'failed';
                 return (
                 <tr key={`${row.tcId}-${row.stepIdx}`} style={{ background: index % 2 === 0 ? '#eef8fc' : '#fff', color: '#333' }}>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px', fontWeight: row.tcTitle ? 'bold' : 'normal' }}>{row.tcTitle}</td>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>{row.step.action}</td>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px' }}>{row.step.expected}</td>
                    <td style={{ border: '1px solid #ccc', padding: '0' }}>
                        <input value={row.step.actualResult || ''} onChange={(e) => updateStepStatus(row.tcId, row.stepIdx, 'actualResult', e.target.value)} style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', padding: '6px 8px', color: '#333', outline: 'none' }} placeholder="Inserir resultado..." />
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '0' }}>
                        <select value={row.step.status} onChange={(e) => updateStepStatus(row.tcId, row.stepIdx, 'status', e.target.value)} style={{ width: '100%', border: 'none', background: 'transparent', padding: '4px', fontWeight: 'bold', outline: 'none', color: isOk ? '#10b981' : isFalha ? '#ef4444' : '#64748b' }}>
                            <option value="pending">Pendente</option>
                            <option value="passed">Ok</option>
                            <option value="failed">Falha</option>
                        </select>
                    </td>
                 </tr>
              )})}
              {allSteps.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Nenhum passo de teste encontrado.</td></tr>}
            </tbody>
          </table>
          </div>
       </div>

       {/* Right side Panels */}
       <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '1rem', flexShrink: 0 }}>
          


          <div style={{ background: '#fff', borderRadius: '4px', border: '1px solid #ccc', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
             <div style={{ background: 'var(--accent-secondary)', padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#fff' }}>INDICADORES DE EXECUÇÃO</div>
             <div style={{ padding: '10px', fontSize: '12px', color: '#333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}><span style={{ color: '#666' }}>Total de Steps</span> <strong>{totalSteps}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}><span style={{ color: '#666' }}>Ok</span> <strong style={{ color: '#10b981' }}>{ok}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}><span style={{ color: '#666' }}>Falha</span> <strong style={{ color: '#ef4444' }}>{falha}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}><span style={{ color: '#666' }}>Pendente</span> <strong style={{ color: '#f59e0b' }}>{pendente}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: '800', fontSize: '13px' }}><span style={{ color: '#666' }}>TAXA DE SUCESSO</span> <strong>{totalSteps === 0 ? '#DIV/0!' : `${taxaSuccess}%`}</strong></div>
             </div>
          </div>

          <div style={{ background: '#fff', borderRadius: '4px', border: '1px solid #ccc', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
             <div style={{ fontWeight: 'bold', color: '#555', marginBottom: '1.5rem', fontSize: '13px', textTransform: 'uppercase' }}>Gráfico de Execução</div>
             <div style={{ width: '160px', height: '160px', borderRadius: '50%', background: pieBg, marginBottom: '1.5rem', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
             <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#555', fontWeight: 'bold' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }}></div> Ok</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }}></div> Falha</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px' }}></div> Pendente</div>
             </div>
          </div>

       </div>
    </div>
  );
};

// --- Security & Shell ---

const LoginView = () => {
  const { setState } = useApp();
  const [name, setName] = useState('');
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
      <div className="stat-card" style={{ width: '400px', padding: '3rem', textAlign: 'center' }}>
        <i className="ph-fill ph-shield-check" style={{ fontSize: '3rem', color: 'var(--accent-primary)', marginBottom: '1.5rem' }}></i>
        <h2 style={{ marginBottom: '2rem' }}>Login QualityOps</h2>
        <input type="text" className="form-input" placeholder="Seu Nome" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && setState(s => ({...s, user: { name: name || 'QA', role: 'Admin' }}))} />
        <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setState(s => ({...s, user: { name: name || 'QA', role: 'Admin' }}))}>Entrar</button>
      </div>
    </div>
  );
};

const Sidebar = () => {
  const { currentView, setCurrentView, state, setState, setSidebarOpen, isSidebarOpen } = useApp();
  const menu = [
    { id: 'dashboard', label: 'Dashboard', icon: 'ph-fill ph-chart-pie' },
    { id: 'requirements', label: 'Tickets', icon: 'ph ph-scroll' },
    { id: 'testCases', label: 'Requisitos', icon: 'ph ph-test-tube' },
    { id: 'spreadsheet', label: 'Planilha', icon: 'ph ph-table' },
    { id: 'bugs', label: 'Bugs', icon: 'ph ph-bug' },
    { id: 'audit', label: 'Auditoria', icon: 'ph ph-fingerprint' }
  ];
  return (
    <aside className={`sidebar ${isSidebarOpen ? 'active' : ''}`}>
      <div style={{ fontWeight: 900, fontSize: '1.5rem', marginBottom: '2.5rem', color: 'var(--text-primary)' }}>QOps<span style={{ color: 'var(--accent-primary)' }}>.</span></div>
      <nav className="nav-menu">
        {menu.map(m => <a key={m.id} className={`nav-item ${currentView === m.id ? 'active' : ''}`} onClick={() => { setCurrentView(m.id); setSidebarOpen(false); }}><i className={m.icon}></i> {m.label}</a>)}
      </nav>
    </aside>
  );
};

const Header = () => {
  const { searchQuery, setSearchQuery, state, setState, setSidebarOpen } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="header">
      <button className="menu-toggle" onClick={() => setSidebarOpen(true)}><i className="ph ph-list"></i></button>
      <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
        <i className="ph ph-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }}></i>
        <input type="text" className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="Busca global..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ textAlign: 'right', fontSize: '0.8rem' }} className="hide-mobile">
          <div style={{ fontWeight: 700 }}>{state.user?.name}</div>
          <div style={{ opacity: 0.5 }}>{state.user?.role}</div>
        </div>
        <div style={{ position: 'relative' }}>
          <div 
            style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, cursor: 'pointer', color: 'white' }}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {state.user?.name?.[0]}
          </div>
          {menuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'var(--surface-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '0.5rem', minWidth: '150px', zIndex: 50 }}>
              <button 
                className="btn" 
                style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--accent-danger)', background: 'transparent', padding: '0.5rem 1rem' }} 
                onClick={() => setState(s => ({...s, user: null}))}
              >
                <i className="ph ph-sign-out"></i> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const Main = () => {
  const { currentView, state } = useApp();
  if (!state.user) return <LoginView />;
  const Content = { dashboard: Dashboard, requirements: Requirements, testCases: TestCases, runner: Runner, bugs: Bugs, audit: Dashboard, spreadsheet: SpreadsheetView }[currentView] || Dashboard;
  return (
    <div id="app">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="content-body"><Content /></main>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<AppProvider><Main /></AppProvider>);
