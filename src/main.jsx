import React, { useState, useEffect, createContext, useContext } from 'react';
import ReactDOM from 'react-dom/client';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, deleteDoc, query, where, getDocs, orderBy } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, updatePassword } from "firebase/auth";
import './style.css';

const firebaseConfig = {
  projectId: "test-manager-8484d",
  appId: "1:904173341193:web:8fc5b68cbe58b487cd06d8",
  storageBucket: "test-manager-8484d.firebasestorage.app",
  apiKey: "AIzaSyB9qc8ejoVx8wNdZIWlb76anr9Lpi8MJKU",
  authDomain: "test-manager-8484d.firebaseapp.com",
  messagingSenderId: "904173341193",
  measurementId: "G-8MPGTP0F2B",
  projectNumber: "904173341193"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// --- Storage & Context ---
const STORAGE_KEY = 'test_manager_v5';

const AppContext = createContext();

const Logo90Ti = ({ style = {}, className = '' }) => (
  <img src="/logo_90ti.png" alt="90ti Logo" style={{ objectFit: 'contain', ...style }} className={className} />
);

const AppProvider = ({ children }) => {
  const [state, setState] = useState({
    projects: [{ id: '1', name: 'Nexus Core', environment: 'Production', description: 'Sistema Principal' }],
    requirements: [], testCases: [], bugs: [], auditLogs: [], sessions: [],
    theme: 'dark',
    currentExecutionInfo: { ticketRef: '', responsible: '', date: new Date().toISOString().split('T')[0], environment: '' },
    user: null
  });
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);

  const [currentView, setCurrentView] = useState('dashboard');
  const [viewParams, setViewParams] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTimers, setActiveTimers] = useState(() => {
    try {
      const saved = localStorage.getItem('test_manager_timers');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return {};
  });
  const [fullScreenImage, setFullScreenImage] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTimers(prev => {
        let changed = false;
        const next = { ...prev };
        for (const tcId in next) {
          if (next[tcId].isRunning) {
            next[tcId] = { ...next[tcId], elapsedTime: next[tcId].elapsedTime + 1 };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('test_manager_timers', JSON.stringify(activeTimers));
    const runningTimers = Object.values(activeTimers).filter(t => t.isRunning);
    if (runningTimers.length > 0) {
      document.title = `(${formatTime(runningTimers[0].elapsedTime)}) Test Manager`;
    } else {
      document.title = 'Test Manager';
    }
  }, [activeTimers]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setState(s => ({ ...s, user: { uid: user.uid, name: user.displayName || user.email.split('@')[0], email: user.email, photoURL: user.photoURL } }));
      } else {
        setState(s => ({ ...s, user: null }));
      }
      setIsAuthLoaded(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!state.user) {
      setIsDataLoaded(true);
      return;
    }
    const unsubReqs = onSnapshot(collection(db, 'requirements'), (snap) => {
      setState(s => ({ ...s, requirements: snap.docs.map(d => ({id: d.id, ...d.data()})) }));
    });
    const unsubTestCases = onSnapshot(collection(db, 'testCases'), (snap) => {
      setState(s => ({ ...s, testCases: snap.docs.map(d => ({id: d.id, ...d.data()})) }));
    });
    const unsubBugs = onSnapshot(collection(db, 'bugs'), (snap) => {
      setState(s => ({ ...s, bugs: snap.docs.map(d => ({id: d.id, ...d.data()})) }));
    });
    const unsubLogs = onSnapshot(collection(db, 'auditLogs'), (snap) => {
      setState(s => ({ ...s, auditLogs: snap.docs.map(d => ({id: d.id, ...d.data()})) }));
    });
    
    setIsDataLoaded(true);
    return () => { unsubReqs(); unsubTestCases(); unsubBugs(); unsubLogs(); };
  }, [state.user?.uid]);

  const logAction = (action, targetId) => {
    const id = crypto.randomUUID();
    const log = { id, timestamp: new Date().toISOString(), userName: state.user?.name || 'Sistema', action, targetId };
    setDoc(doc(db, 'auditLogs', id), log).catch(console.error);
  };

  const deleteItem = async (type, id) => {
    try {
      await deleteDoc(doc(db, type, id));
      if (type === 'requirements') {
        const deletedTestCases = state.testCases.filter(tc => tc.requirementId === id);
        for (const tc of deletedTestCases) {
          await deleteDoc(doc(db, 'testCases', tc.id));
          const deletedBugs = state.bugs.filter(b => b.caseId === tc.id);
          for (const b of deletedBugs) {
             await deleteDoc(doc(db, 'bugs', b.id));
          }
        }
      } else if (type === 'testCases') {
        const deletedBugs = state.bugs.filter(b => b.caseId === id);
        for (const b of deletedBugs) {
           await deleteDoc(doc(db, 'bugs', b.id));
        }
      }
      logAction(`Excluiu de ${type}`, id);
    } catch(e) {
      console.error(e);
    }
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
    updateExecutionInfo, activeTimers, setActiveTimers, fullScreenImage, setFullScreenImage
  };

  if (!isAuthLoaded || !isDataLoaded || !state) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-primary)', flexDirection: 'column', gap: '1rem' }}>
      <i className="ph ph-spinner ph-spin" style={{ fontSize: '3rem', color: 'var(--accent-primary)' }}></i>
      <h2>Sincronizando com a Nuvem...</h2>
    </div>;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

const useApp = () => useContext(AppContext);

// --- Util Functions ---
export const formatTime = (seconds) => {
  if (seconds === undefined) return '-';
  const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
};

export const compressImage = (file, maxSize = 1200) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};

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
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--accent-danger)' }}>
            {state.bugs.filter(b => {
              const tc = state.testCases.find(t => t.id === b.caseId);
              return b.status === 'Aberto' && tc && tc.status === 'Reprovado';
            }).length}
          </div>
        </div>
        <div className="stat-card">
           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h4 style={{ color: 'var(--text-secondary)' }}>TICKETS</h4>
            <i className="ph ph-ticket" style={{ color: 'var(--accent-info)' }}></i>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '0.5rem' }}>{state.requirements.length}</div>
        </div>
      </div>
      
    </div>
  );
};

// --- View: Requirements ---
const TeamDropdown = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const teams = ["Equipe Compor Engenharia", "Equipe Compor Backoffice", "Equipe WEB - APP", "Equipe WEB - Gestão Obras", "Equipe WEB - Cadastro", "Equipe WEB - Suprimentos", "Equipe Orçamento/Checklist"];
  const filtered = teams.filter(t => t.toLowerCase().includes((value || '').toLowerCase()));

  return (
    <div style={{ position: 'relative', zIndex: 999 }}>
      <input 
        className="form-input" 
        placeholder="Selecione ou digite a equipe..." 
        value={value} 
        onChange={e => { onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
      />
      <i className="ph ph-caret-down" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}></i>
      {isOpen && filtered.length > 0 && (
        <div className="animate-fade" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '4px', zIndex: 1000, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
          {filtered.map(t => (
            <div 
              key={t} 
              style={{ padding: '0.8rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-primary)', transition: 'background 0.2s' }}
              onMouseDown={(e) => { e.preventDefault(); onChange(t); setIsOpen(false); }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Requirements = () => {
  const { state, setState, deleteItem, logAction } = useApp();
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ code: '', title: '', description: '', team: '' });
  const [filters, setFilters] = useState({ text: '', user: '', team: '' });

  const uniqueUsers = [...new Set(state.requirements.map(r => r.createdBy).filter(Boolean))];
  const uniqueTeams = [...new Set(state.requirements.map(r => r.team).filter(Boolean))];

  const filtered = state.requirements.filter(r => {
    const matchText = r.title.toLowerCase().includes(filters.text.toLowerCase()) || r.code.toLowerCase().includes(filters.text.toLowerCase()) || r.description.toLowerCase().includes(filters.text.toLowerCase());
    const matchUser = filters.user ? r.createdBy === filters.user : true;
    const matchTeam = filters.team ? r.team === filters.team : true;
    return matchText && matchUser && matchTeam;
  });

  const openNew = () => {
    setEditingId(null);
    setForm({ code: '', title: '', description: '', team: '' });
    setModal(true);
  };

  const openEdit = (req) => {
    setEditingId(req.id);
    setForm({ code: req.code, title: req.title, description: req.description, team: req.team || '' });
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (editingId) {
      await setDoc(doc(db, 'requirements', editingId), { ...form, id: editingId, updatedBy: state.user?.name || 'Sistema' }, { merge: true });
      logAction('Editou Ticket', editingId);
    } else {
      const id = crypto.randomUUID();
      await setDoc(doc(db, 'requirements', id), { ...form, id, createdBy: state.user?.name || 'Sistema' });
      logAction('Criou Ticket', id);
    }
    setModal(false);
    setForm({ code: '', title: '', description: '', team: '' });
    setEditingId(null);
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3>Mapeamento de Tickets</h3>
        <button className="btn btn-primary" onClick={openNew}><i className="ph ph-plus"></i> Novo Ticket</button>
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', background: 'var(--surface-solid)', padding: '1rem', borderRadius: '8px' }}>
        <input className="form-input" placeholder="Pesquisar por Código, Título ou Descrição..." value={filters.text} onChange={e => setFilters({...filters, text: e.target.value})} style={{ flex: 2 }} />
        <select className="form-select" value={filters.user} onChange={e => setFilters({...filters, user: e.target.value})} style={{ flex: 1 }}>
          <option value="">Todos os Usuários</option>
          {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select className="form-select" value={filters.team} onChange={e => setFilters({...filters, team: e.target.value})} style={{ flex: 1 }}>
          <option value="">Todas as Equipes</option>
          {uniqueTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="stat-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr><th>Código</th><th>Título</th><th>Descrição</th><th>Equipe</th><th>Criador</th><th style={{ textAlign: 'right' }}>Ações</th></tr></thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{r.code}</td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }} title={r.title}>{r.title?.length > 45 ? r.title.substring(0, 45) + '...' : r.title}</td>
                <td style={{ color: 'var(--text-primary)' }} title={r.description}>{r.description?.length > 60 ? r.description.substring(0, 60) + '...' : r.description}</td>
                <td style={{ color: 'var(--text-primary)' }}>{r.team || '-'}</td>
                <td style={{ color: 'var(--text-primary)' }}>{r.createdBy || '-'}</td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    {(() => {
                      const canEdit = state.user?.name && r.createdBy === state.user.name;
                      return (
                        <>
                          <button className="btn" onClick={() => { if (!canEdit) { alert('Acesso negado: Apenas o criador deste ticket pode editá-lo.'); return; } openEdit(r); }} style={{ padding: '0.5rem', border: '1px solid var(--border-color)', background: canEdit ? 'transparent' : 'var(--surface-solid)', color: canEdit ? 'var(--text-secondary)' : 'var(--text-muted)', opacity: canEdit ? 1 : 0.4, cursor: canEdit ? 'pointer' : 'not-allowed' }} title={canEdit ? "Editar" : "Apenas o criador pode editar"}><i className="ph ph-pencil"></i></button>
                          <button className={`btn ${canEdit ? 'btn-danger' : ''}`} onClick={() => { if (!canEdit) { alert('Acesso negado: Apenas o criador deste ticket pode excluí-lo.'); return; } deleteItem('requirements', r.id); }} style={{ padding: '0.5rem', opacity: canEdit ? 1 : 0.4, cursor: canEdit ? 'pointer' : 'not-allowed', background: canEdit ? '' : 'var(--surface-solid)', color: canEdit ? '' : 'var(--text-secondary)', border: canEdit ? '' : '1px solid var(--border-color)' }} title={canEdit ? "Excluir" : "Apenas o criador pode excluir"}><i className="ph ph-trash"></i></button>
                        </>
                      );
                    })()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editingId ? "Editar Ticket" : "Novo Ticket"}>
        <form onSubmit={save}>
          <div className="form-group"><label className="form-label">Código</label><input type="text" inputMode="numeric" pattern="[0-9]*" className="form-input" required value={form.code} onChange={e => setForm({...form, code: e.target.value.replace(/\D/g, '')})} /></div>
          <div className="form-group"><label className="form-label">Título</label><input className="form-input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div className="form-group" style={{ position: 'relative', zIndex: 999 }}>
            <label className="form-label">Equipe</label>
            <TeamDropdown value={form.team} onChange={(val) => setForm({...form, team: val})} />
          </div>
          <div className="form-group" style={{ position: 'relative', zIndex: 1 }}>
            <label className="form-label">Descrição</label>
            <textarea className="form-textarea" rows="3" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', position: 'relative', zIndex: 1 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// --- Timeline Modal ---
const TimelineModal = ({ isOpen, onClose, tcId }) => {
  const { state } = useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !tcId) return;
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const tc = state.testCases.find(t => t.id === tcId);
        if (!tc) return;
        const reqId = tc.requirementId;
        const bugs = state.bugs.filter(b => b.caseId === tcId).map(b => b.id);
        
        const targets = [tcId, reqId, ...bugs].filter(Boolean);
        
        let allLogs = [];
        for (const target of targets) {
          const q = query(collection(db, 'auditLogs'), where('targetId', '==', target));
          const snapshot = await getDocs(q);
          snapshot.forEach(docSnap => allLogs.push(docSnap.data()));
        }
        
        allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(allLogs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [isOpen, tcId]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Timeline e Histórico">
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando histórico...</div>
      ) : (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '1rem', paddingLeft: '1rem' }}>
          {logs.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum histórico encontrado.</p>
          ) : (
            <div style={{ position: 'relative', borderLeft: '2px solid var(--border-color)', marginLeft: '1rem', paddingBottom: '1rem', marginTop: '1rem' }}>
              {logs.map((log) => {
                const actionLower = log.action.toLowerCase();
                const isBug = actionLower.includes('bug');
                const isSuccess = actionLower.includes('sucesso') || actionLower.includes('fechad');
                const isEdit = actionLower.includes('editou');
                const iconColor = isBug ? 'var(--accent-danger)' : isSuccess ? 'var(--accent-success)' : isEdit ? 'var(--accent-info)' : 'var(--accent-primary)';
                const iconClass = isBug ? 'ph-bug' : isSuccess ? 'ph-check-circle' : isEdit ? 'ph-pencil' : 'ph-clock-counter-clockwise';
                
                return (
                  <div key={log.id} style={{ position: 'relative', paddingLeft: '2rem', marginBottom: '1.5rem' }}>
                    <div style={{ position: 'absolute', left: '-13px', top: '0', width: '24px', height: '24px', background: iconColor, borderRadius: '50%', border: '4px solid var(--surface-solid)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      <i className={`ph ${iconClass}`} style={{ fontSize: '12px' }}></i>
                    </div>
                    <div style={{ background: 'var(--surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        {new Date(log.timestamp).toLocaleString()} • <strong>{log.userName}</strong>
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.action}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

// --- View: TestCases ---
const TicketDropdown = ({ requirements, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedReq = requirements.find(r => r.id === value);
  const displayValue = isOpen ? search : (selectedReq ? `${selectedReq.code} - ${selectedReq.title}` : (value ? '' : 'Todos os Tickets'));

  const filtered = requirements.filter(r => {
    const term = search.toLowerCase();
    return r.code.toLowerCase().includes(term) || r.title.toLowerCase().includes(term);
  });

  return (
    <div style={{ position: 'relative', zIndex: 999, width: '300px' }}>
      <input 
        className="form-input" 
        placeholder="Pesquisar ticket..." 
        value={displayValue} 
        onChange={e => { setSearch(e.target.value); setIsOpen(true); if (value) onChange(''); }}
        onFocus={() => { setIsOpen(true); setSearch(''); }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        style={{ color: 'white', borderColor: 'var(--accent-secondary)', backgroundColor: 'var(--accent-secondary)', fontWeight: 'bold', cursor: 'pointer', paddingRight: '2rem' }}
      />
      {value ? (
        <i className="ph ph-x" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }} onClick={() => { onChange(''); setSearch(''); }}></i>
      ) : (
        <i className="ph ph-caret-down" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.8)', pointerEvents: 'none' }}></i>
      )}
      
      {isOpen && (
        <div className="animate-fade" style={{ position: 'absolute', top: '100%', right: 0, width: '100%', background: 'var(--surface-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '4px', zIndex: 1000, maxHeight: '300px', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)', textAlign: 'left' }}>
          <div 
            style={{ padding: '0.8rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-primary)', transition: 'background 0.2s', fontWeight: value === '' ? 'bold' : 'normal' }}
            onMouseDown={(e) => { e.preventDefault(); onChange(''); setIsOpen(false); }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Todos os Tickets
          </div>
          {filtered.length > 0 ? filtered.map(r => (
            <div 
              key={r.id} 
              style={{ padding: '0.8rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-primary)', transition: 'background 0.2s', fontWeight: value === r.id ? 'bold' : 'normal' }}
              onMouseDown={(e) => { e.preventDefault(); onChange(r.id); setIsOpen(false); }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>{r.code}</div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
            </div>
          )) : (
            <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.5, fontSize: '0.9rem' }}>Nenhum ticket encontrado</div>
          )}
        </div>
      )}
    </div>
  );
};

const UserMultiSelect = ({ users, value = [], onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const filtered = users.filter(u => u.toLowerCase().includes(search.toLowerCase()) && !value.includes(u));

  const add = (u) => { onChange([...value, u]); setSearch(''); setIsOpen(false); };
  const remove = (u) => { onChange(value.filter(v => v !== u)); };

  return (
    <div style={{ position: 'relative', zIndex: 998 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {value.map(v => (
          <span key={v} style={{ background: 'var(--accent-primary)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {v} <i className="ph ph-x" style={{ cursor: 'pointer' }} onClick={() => remove(v)}></i>
          </span>
        ))}
      </div>
      <input 
        className="form-input" 
        placeholder="Pesquisar ou adicionar usuário..." 
        value={search} 
        onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
      />
      {isOpen && filtered.length > 0 && (
        <div className="animate-fade" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '4px', zIndex: 1000, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
          {filtered.map(u => (
            <div 
              key={u} 
              style={{ padding: '0.8rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-primary)', transition: 'background 0.2s' }}
              onMouseDown={(e) => { e.preventDefault(); add(u); }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {u}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const generateFlowchart = (tc) => {
  if (!tc || !tc.steps || tc.steps.length === 0) return 'graph TD\n  A[Início] --> B[Fim]';
  
  let chart = 'graph TD\n';
  chart += '  Start((Início))\n';
  
  let lastNode = 'Start';
  
  tc.steps.forEach((step, i) => {
    const actionNode = `A${i}["${step.action.replace(/"/g, "'")}"]`;
    const expectedNode = `E${i}{"${step.expected.replace(/"/g, "'")}"}`;
    chart += `  ${lastNode} --> ${actionNode}\n`;
    chart += `  ${actionNode} --> ${expectedNode}\n`;
    lastNode = `E${i}`;
  });
  chart += `  ${lastNode} --> End((Fim))\n`;
  
  return chart;
};

const Mermaid = ({ chart }) => {
  const containerRef = React.useRef(null);
  useEffect(() => {
    if (containerRef.current && window.mermaid) {
      window.mermaid.render('mermaid-chart-' + Date.now(), chart).then(({ svg }) => {
        if(containerRef.current) containerRef.current.innerHTML = svg;
      }).catch(e => console.error(e));
    }
  }, [chart]);
  return <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center', background: 'var(--surface-solid)', padding: '1rem', borderRadius: '8px' }} />;
};

const TestCases = () => {
  const { state, setState, searchQuery, deleteItem, logAction, setCurrentView, setViewParams, setFullScreenImage } = useApp();
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', requirementId: '', priority: 'Média', group: '', preRequisites: '', linkedUsers: [], steps: [{ action: '', expected: '', status: 'pending', testData: '', actualResult: '', requirementRuleMet: '' }] });
  const [activeModalTab, setActiveModalTab] = useState('details');
  const [timelineTcId, setTimelineTcId] = useState(null);

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [ticketFilter, setTicketFilter] = useState('');
  const [expandedTickets, setExpandedTickets] = useState({});
  const [draggedTcId, setDraggedTcId] = useState(null);
  const [dragOverTcId, setDragOverTcId] = useState(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState(null);
  const [dragOverStepIndex, setDragOverStepIndex] = useState(null);

  const toggleTicket = (ticketId) => {
    setExpandedTickets(prev => ({ ...prev, [ticketId]: !prev[ticketId] }));
  };

  const toggleAllTickets = () => {
    const allExpanded = Object.keys(groupedTestCases).length > 0 && Object.keys(groupedTestCases).every(key => expandedTickets[key]);
    if (allExpanded) {
      setExpandedTickets({});
    } else {
      const newExpanded = {};
      Object.keys(groupedTestCases).forEach(key => newExpanded[key] = true);
      setExpandedTickets(newExpanded);
    }
  };

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

  const handleTcDragStart = (e, tcId) => {
    setDraggedTcId(tcId);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleTcDragEnter = (tcId) => {
    setDragOverTcId(tcId);
  };
  const handleTcDrop = async (ticketId) => {
    if (!draggedTcId || !dragOverTcId || draggedTcId === dragOverTcId) {
      setDraggedTcId(null);
      setDragOverTcId(null);
      return;
    }
    
    const tcs = [...(groupedTestCases[ticketId] || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const draggedIdx = tcs.findIndex(t => t.id === draggedTcId);
    const dropIdx = tcs.findIndex(t => t.id === dragOverTcId);
    
    if (draggedIdx > -1 && dropIdx > -1) {
      const draggedItem = tcs.splice(draggedIdx, 1)[0];
      tcs.splice(dropIdx, 0, draggedItem);
      
      const promises = tcs.map((t, index) => 
        setDoc(doc(db, 'testCases', t.id), { order: index }, { merge: true })
      );
      await Promise.all(promises);
      logAction('Reordenou Casos de Teste', ticketId);
    }
    setDraggedTcId(null);
    setDragOverTcId(null);
  };

  const handleStepDragStart = (e, index) => {
    setDraggedStepIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleStepDragEnter = (index) => {
    setDragOverStepIndex(index);
  };
  const handleStepDrop = () => {
    if (draggedStepIndex === null || dragOverStepIndex === null || draggedStepIndex === dragOverStepIndex) {
      setDraggedStepIndex(null);
      setDragOverStepIndex(null);
      return;
    }
    const newSteps = [...form.steps];
    const draggedItem = newSteps.splice(draggedStepIndex, 1)[0];
    newSteps.splice(dragOverStepIndex, 0, draggedItem);
    setForm({ ...form, steps: newSteps });
    setDraggedStepIndex(null);
    setDragOverStepIndex(null);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ title: '', requirementId: '', priority: 'Média', group: '', preRequisites: '', linkedUsers: [], steps: [{ action: '', expected: '', status: 'pending', testData: '', actualResult: '', requirementRuleMet: '' }] });
    setActiveModalTab('details');
    setModal(true);
  };

  const openEdit = (tc) => {
    setEditingId(tc.id);
    setForm({ title: tc.title, requirementId: tc.requirementId, priority: tc.priority, group: tc.group || '', preRequisites: tc.preRequisites || '', linkedUsers: tc.linkedUsers || (tc.linkedUser ? [tc.linkedUser] : []), steps: JSON.parse(JSON.stringify(tc.steps)) });
    setActiveModalTab('details');
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (editingId) {
      const steps = form.steps || [];
      const hasFail = steps.some(st => st.status === 'failed');
      const hasPass = steps.some(st => st.status === 'passed');
      const allPass = steps.length > 0 && steps.every(st => st.status === 'passed');
      const allPending = steps.every(st => st.status === 'pending');
      
      const oldTC = state.testCases.find(t => t.id === editingId) || {};
      let newStatus = oldTC.status;
      if (allPending) newStatus = 'Não executado';
      else if (allPass) newStatus = 'Aprovado';
      else if (hasFail) newStatus = 'Reprovado';
      else if (hasPass) newStatus = 'Parcial';
      
      await setDoc(doc(db, 'testCases', editingId), { ...form, id: editingId, status: newStatus }, { merge: true });
      logAction('Editou Caso de Teste', editingId);
    } else {
      const id = crypto.randomUUID();
      const currentTicketCTs = state.testCases.filter(t => (t.requirementId || 'unlinked') === (form.requirementId || 'unlinked'));
      const nextOrder = currentTicketCTs.length;
      await setDoc(doc(db, 'testCases', id), { ...form, id, status: 'Não executado', createdBy: state.user?.name || 'Sistema', order: nextOrder });
      logAction('Criou Caso de Teste', id);
    }
    setModal(false);
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
        <h3>Casos de Teste</h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <TicketDropdown requirements={state.requirements} value={ticketFilter} onChange={setTicketFilter} />
          <button className="btn btn-primary" onClick={openNew}><i className="ph ph-plus"></i> Novo CT</button>
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button className="btn btn-soft" onClick={toggleAllTickets} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>
          <i className="ph ph-list-plus"></i> {Object.keys(groupedTestCases).length > 0 && Object.keys(groupedTestCases).every(key => expandedTickets[key]) ? 'Recolher Todos' : 'Expandir Todos'}
        </button>
      </div>
      <div className="stat-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>Ticket</th>
              <th style={{ textAlign: 'center' }}>Título</th>
              <th style={{ textAlign: 'center' }}>Prioridade</th>
              <th style={{ textAlign: 'center' }}>Tempo</th>
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
                      <td colSpan="6" style={{ padding: '0.5rem', textAlign: 'left' }}>
                       <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
                         <i className={`ph ph-caret-${isExpanded ? 'down' : 'right'}`}></i>
                         {ticketName} ({groupedTestCases[ticketId].length})
                       </div>
                     </td>
                   </tr>
                   {isExpanded && [...groupedTestCases[ticketId]].sort((a,b) => (a.order || 0) - (b.order || 0)).map(t => (
                     <tr 
                       key={t.id}
                       draggable
                       onDragStart={(e) => handleTcDragStart(e, t.id)}
                       onDragEnter={() => handleTcDragEnter(t.id)}
                       onDragEnd={() => { setDraggedTcId(null); setDragOverTcId(null); }}
                       onDragOver={(e) => e.preventDefault()}
                       onDrop={() => handleTcDrop(ticketId)}
                       style={{ 
                         cursor: 'grab', 
                         opacity: draggedTcId === t.id ? 0.5 : 1,
                         borderTop: dragOverTcId === t.id && draggedTcId !== t.id ? '2px dashed var(--accent-primary)' : 'none',
                         borderBottom: '1px solid var(--border-color)'
                       }}
                     >
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--accent-primary)' }}>{ticket ? ticket.code : '-'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{t.title}</td>
                        <td style={{ textAlign: 'center' }}><Badge>{t.priority}</Badge></td>
                        <td style={{ textAlign: 'center' }}>{t.executionTime !== undefined ? formatTime(t.executionTime) : '-'}</td>
                        <td style={{ textAlign: 'center' }}><Badge>{t.status}</Badge></td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                           {(() => {
                             const tcOwner = t.createdBy || ticket?.createdBy;
                             const canEdit = state.user?.name && (tcOwner === state.user.name || t.linkedUser === state.user.name || t.linkedUsers?.includes(state.user.name));
                             return (
                               <button 
                                 className="btn" 
                                 onClick={() => {
                                   if (!canEdit) {
                                     alert(`Acesso negado: Apenas o criador (${tcOwner || 'N/A'}) ou o usuário vinculado podem editar este caso de teste.`);
                                     return;
                                   }
                                   openEdit(t);
                                 }} 
                                 style={{ padding: '0.5rem', border: '1px solid var(--border-color)', background: canEdit ? 'transparent' : 'var(--surface-solid)', color: canEdit ? 'var(--text-secondary)' : 'var(--text-muted)', opacity: canEdit ? 1 : 0.4, cursor: canEdit ? 'pointer' : 'not-allowed' }} 
                                 title={canEdit ? "Editar" : `Apenas o criador ou usuário vinculado podem editar`}
                               >
                                 <i className="ph ph-pencil"></i>
                               </button>
                             );
                           })()}
                           <button className="btn btn-soft" onClick={() => setTimelineTcId(t.id)} style={{ padding: '0.5rem', color: 'var(--accent-info)' }} title="Histórico / Timeline">
                             <i className="ph ph-clock-counter-clockwise"></i>
                           </button>
                           {(() => {
                             const canExecute = state.user?.name && (t.createdBy === state.user.name || ticket?.createdBy === state.user.name || t.linkedUser === state.user.name || t.linkedUsers?.includes(state.user.name));
                             return (
                               <button 
                                 className={`btn ${canExecute ? 'btn-primary' : ''}`} 
                                 onClick={() => {
                                   if (!canExecute) {
                                     alert(`Acesso negado: Apenas o criador do caso de teste, do ticket, ou o usuário vinculado podem executar.`);
                                     return;
                                   }
                                   setViewParams(t.id); 
                                   setCurrentView('runner'); 
                                 }} 
                                 style={{ padding: '0.5rem', opacity: canExecute ? 1 : 0.4, cursor: canExecute ? 'pointer' : 'not-allowed', background: canExecute ? '' : 'var(--surface-solid)', color: canExecute ? '' : 'var(--text-secondary)', border: canExecute ? '' : '1px solid var(--border-color)' }} 
                                 title={canExecute ? "Executar" : `Acesso restrito`}
                               >
                                 <i className="ph ph-play"></i>
                               </button>
                             );
                           })()}
                           {(() => {
                             const tcOwner = t.createdBy || ticket?.createdBy;
                             const canEdit = state.user?.name && (tcOwner === state.user.name || t.linkedUser === state.user.name || t.linkedUsers?.includes(state.user.name));
                             return (
                               <button 
                                 className={`btn ${canEdit ? 'btn-danger' : ''}`} 
                                 onClick={() => {
                                   if (!canEdit) {
                                     alert(`Acesso negado: Apenas o criador (${tcOwner || 'N/A'}) ou o usuário vinculado podem excluir este caso de teste.`);
                                     return;
                                   }
                                   setDeleteConfirm(t.id);
                                 }} 
                                 style={{ padding: '0.5rem', opacity: canEdit ? 1 : 0.4, cursor: canEdit ? 'pointer' : 'not-allowed', background: canEdit ? '' : 'var(--surface-solid)', color: canEdit ? '' : 'var(--text-secondary)', border: canEdit ? '' : '1px solid var(--border-color)' }} 
                                 title={canEdit ? "Excluir" : `Apenas o criador ou usuário vinculado podem excluir`}
                               >
                                 <i className="ph ph-trash"></i>
                               </button>
                             );
                           })()}
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
        {editingId && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button className="btn" onClick={() => setActiveModalTab('details')} style={{ background: 'transparent', border: 'none', borderBottom: activeModalTab === 'details' ? '2px solid var(--accent-primary)' : '2px solid transparent', borderRadius: 0, padding: '0.5rem 1rem', color: activeModalTab === 'details' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>Detalhes</button>
            <button className="btn" onClick={() => setActiveModalTab('history')} style={{ background: 'transparent', border: 'none', borderBottom: activeModalTab === 'history' ? '2px solid var(--accent-primary)' : '2px solid transparent', borderRadius: 0, padding: '0.5rem 1rem', color: activeModalTab === 'history' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>Histórico de Execuções</button>
            <button className="btn" onClick={() => setActiveModalTab('diagram')} style={{ background: 'transparent', border: 'none', borderBottom: activeModalTab === 'diagram' ? '2px solid var(--accent-primary)' : '2px solid transparent', borderRadius: 0, padding: '0.5rem 1rem', color: activeModalTab === 'diagram' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>Fluxo (Diagrama)</button>
          </div>
        )}
        
        {activeModalTab === 'details' ? (
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
            <div className="form-group">
              <label className="form-label">Pré-Requisitos (Opcional)</label>
              <textarea className="form-input" rows="2" placeholder="O que é necessário antes de executar este teste?" value={form.preRequisites || ''} onChange={e => setForm({...form, preRequisites: e.target.value})}></textarea>
            </div>
            <div className="form-group">
              <label className="form-label">Grupo/Categoria (Opcional)</label>
              <input className="form-input" placeholder="Ex: Regressivo, Login, Positivo..." value={form.group || ''} onChange={e => setForm({...form, group: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Usuários Vinculados</label>
              <UserMultiSelect 
                users={[...new Set([...state.requirements.map(r=>r.createdBy), ...state.testCases.map(t=>t.createdBy), ...state.testCases.flatMap(t=>t.linkedUsers || (t.linkedUser ? [t.linkedUser] : []))].filter(Boolean))]} 
                value={form.linkedUsers} 
                onChange={(val) => setForm({...form, linkedUsers: val})} 
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Passos do Teste</label>
              {form.steps.map((st, i) => (
                <div 
                  key={i} 
                  draggable
                  onDragStart={(e) => handleStepDragStart(e, i)}
                  onDragEnter={() => handleStepDragEnter(i)}
                  onDragEnd={() => { setDraggedStepIndex(null); setDragOverStepIndex(null); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleStepDrop}
                  style={{ 
                    display: 'flex', 
                    gap: '0.5rem', 
                    marginBottom: '0.5rem',
                    alignItems: 'center',
                    cursor: 'grab',
                    opacity: draggedStepIndex === i ? 0.5 : 1,
                    borderTop: dragOverStepIndex === i && draggedStepIndex !== i ? '2px dashed var(--accent-primary)' : 'none',
                    padding: '0.25rem 0',
                    transition: 'border 0.2s'
                  }}
                >
                  <i className="ph ph-dots-six-vertical" style={{ color: 'var(--text-muted)', cursor: 'grab', fontSize: '1.2rem' }}></i>
                  <input className="form-input" placeholder="Ação" value={st.action} onChange={e => { const steps = [...form.steps]; steps[i].action = e.target.value; setForm({...form, steps}); }} />
                  <input className="form-input" placeholder="Esperado" value={st.expected} onChange={e => { const steps = [...form.steps]; steps[i].expected = e.target.value; setForm({...form, steps}); }} />
                  <button type="button" className="btn btn-danger" onClick={() => { const steps = form.steps.filter((_, idx) => idx !== i); setForm({...form, steps}); }} style={{ padding: '0.5rem' }} title="Remover Passo"><i className="ph ph-trash"></i></button>
                </div>
              ))}
              <button type="button" className="btn" onClick={addStep} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>+ Passo</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">{editingId ? "Atualizar CT" : "Salvar CT"}</button>
            </div>
          </form>
        ) : activeModalTab === 'history' ? (
          <div>
            {(() => {
              const tc = state.testCases.find(t => t.id === editingId);
              if (!tc || !tc.executions || tc.executions.length === 0) return <p style={{ color: 'var(--text-secondary)' }}>Nenhuma execução registrada.</p>;
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {tc.executions.slice().reverse().map((exec, idx) => (
                    <div key={exec.id} style={{ background: 'var(--surface-solid)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div>
                          <strong>Data:</strong> {new Date(exec.date).toLocaleString()}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <span><strong>Tempo:</strong> {formatTime(exec.executionTime)}</span>
                          <Badge>{exec.status}</Badge>
                        </div>
                      </div>
                      <div>
                        {exec.stepsSnapshot.map((st, i) => (
                          <div key={i} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px dashed var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span><strong>Passo {i+1}:</strong> {st.action}</span>
                              <Badge>{st.status}</Badge>
                            </div>
                            {(st.status === 'failed' || st.status === 'passed') && st.failureLog && (
                              <div style={{ background: st.status === 'failed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', padding: '0.5rem', marginTop: '0.5rem', borderRadius: '4px', borderLeft: `3px solid ${st.status === 'failed' ? 'var(--accent-danger)' : 'var(--accent-success)'}` }}>
                                {st.failureLog}
                              </div>
                            )}
                            {st.evidences && st.evidences.length > 0 && (
                              <div className="evidence-container" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {st.evidences.map((ev, evIdx) => (
                                  <img key={evIdx} src={ev} alt="Evidência" className="evidence-img" onClick={() => setFullScreenImage(ev)} style={{ maxHeight: '80px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)' }} title="Ampliar" />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        ) : activeModalTab === 'diagram' ? (
          <div>
            {(() => {
              const tc = state.testCases.find(t => t.id === editingId);
              if (!tc) return null;
              const chart = generateFlowchart(tc);
              return <Mermaid chart={chart} />;
            })()}
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmar Exclusão">
        <p>Tem certeza que deseja excluir este requisito?</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button type="button" className="btn" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
          <button type="button" className="btn btn-danger" onClick={() => { deleteItem('testCases', deleteConfirm); setDeleteConfirm(null); }}>Excluir</button>
        </div>
      </Modal>

      <TimelineModal isOpen={!!timelineTcId} onClose={() => setTimelineTcId(null)} tcId={timelineTcId} />
    </div>
  );
};

// --- View: Execution Runner ---
const Runner = () => {
  const { state, setState, viewParams, setCurrentView, logAction, activeTimers, setActiveTimers, setFullScreenImage } = useApp();
  const tc = state.testCases.find(t => t.id === viewParams);

  const [localSteps, setLocalSteps] = useState(() => {
    if (!tc) return [];
    try {
      const saved = localStorage.getItem(`test_manager_runner_${tc.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length === tc.steps.length) {
          return parsed.map((p, i) => ({
            ...p,
            action: tc.steps[i].action,
            expected: tc.steps[i].expected
          }));
        }
        localStorage.removeItem(`test_manager_runner_${tc.id}`);
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(tc.steps));
  });

  useEffect(() => {
    if (tc) {
      localStorage.setItem(`test_manager_runner_${tc.id}`, JSON.stringify(localSteps));
    }
  }, [localSteps, tc?.id]);
  
  const timerState = activeTimers[tc?.id] || { elapsedTime: tc?.executionTime || 0, isRunning: false };
  const elapsedTime = timerState.elapsedTime;
  const isRunning = timerState.isRunning;

  const toggleIsRunning = () => {
    if (!timerState.isRunning) {
      const isAnyOtherRunning = Object.entries(activeTimers).some(([id, t]) => id !== tc.id && t.isRunning);
      if (isAnyOtherRunning) {
        alert('Você já possui outro caso de teste em execução. Pause ou finalize-o antes de iniciar este.');
        return;
      }
    }
    setActiveTimers(prev => {
      const currentState = prev[tc.id] || { title: tc.title, elapsedTime: tc.executionTime || 0, isRunning: false };
      return { ...prev, [tc.id]: { ...currentState, isRunning: !currentState.isRunning } };
    });
  };

  if (!tc) return <div>CT não encontrado.</div>;

  const updateStep = (idx, field, value) => {
    setLocalSteps(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleStatusChange = (idx, status) => {
    const currentStatus = localSteps[idx].status;
    const newStatus = currentStatus === status ? 'pending' : status;
    setLocalSteps(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], status: newStatus };
      if (newStatus !== 'failed') copy[idx].failureLog = '';
      return copy;
    });
  };

  const handleFileUpload = async (idx, e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const compressedBase64 = await compressImage(file);
        setLocalSteps(prev => {
          const copy = [...prev];
          copy[idx] = { ...copy[idx] };
          copy[idx].evidences = copy[idx].evidences || [];
          copy[idx].evidences.push(compressedBase64);
          return copy;
        });
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setLocalSteps(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx] };
            copy[idx].evidences = copy[idx].evidences || [];
            copy[idx].evidences.push(reader.result);
            return copy;
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };
  
  const removeEvidence = (stepIdx, evIdx) => {
    setLocalSteps(prev => {
      const copy = [...prev];
      copy[stepIdx] = { ...copy[stepIdx] };
      copy[stepIdx].evidences = copy[stepIdx].evidences.filter((_, i) => i !== evIdx);
      return copy;
    });
  };

  const finish = async () => {
    const hasFail = localSteps.some(s => s.status === 'failed');
    const allPass = localSteps.every(s => s.status === 'passed');
    const finalStatus = allPass ? 'Aprovado' : hasFail ? 'Reprovado' : 'Parcial';
    
    const bugAlreadyExists = state.bugs.some(b => b.caseId === tc.id && b.status === 'Aberto');
    const shouldCreateBug = hasFail && !bugAlreadyExists;
    const bugId = shouldCreateBug ? crypto.randomUUID() : null;

    const executions = tc.executions || [];
    executions.push({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      status: finalStatus,
      executionTime: elapsedTime,
      stepsSnapshot: JSON.parse(JSON.stringify(localSteps))
    });

    await setDoc(doc(db, 'testCases', tc.id), { steps: localSteps, status: finalStatus, executionTime: elapsedTime, executions }, { merge: true });
    
    if (shouldCreateBug) {
      await setDoc(doc(db, 'bugs', bugId), { id: bugId, caseId: tc.id, title: `Falha: ${tc.title}`, status: 'Aberto', severity: 'Alta', executionTime: elapsedTime, createdBy: state.user?.name || 'Sistema' });
      logAction('Bug Automático detectado', bugId);
    } else if (hasFail && bugAlreadyExists) {
      const bug = state.bugs.find(b => b.caseId === tc.id && b.status === 'Aberto');
      if (bug) await setDoc(doc(db, 'bugs', bug.id), { executionTime: elapsedTime }, { merge: true });
    }
    
    logAction('Execução finalizada', tc.id);
    localStorage.removeItem(`test_manager_runner_${tc.id}`);
    setActiveTimers(prev => {
      const next = { ...prev };
      delete next[tc.id];
      return next;
    });
    setCurrentView('testCases');
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        <span style={{ cursor: 'pointer' }} onClick={() => setCurrentView('testCases')}>Casos de Teste</span>
        <i className="ph ph-caret-right"></i>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Execução</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <h3 style={{ margin: 0 }}>Execução: {tc.title}</h3>
             <div style={{ background: 'var(--accent-primary)', padding: '0.25rem 0.75rem', borderRadius: '1rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <i className="ph ph-timer"></i> {formatTime(elapsedTime)}
               <button onClick={toggleIsRunning} title={isRunning ? "Pausar" : "Retomar"} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 0, marginLeft: '4px', display: 'flex', alignItems: 'center' }}>
                 <i className={isRunning ? "ph ph-pause-circle" : "ph ph-play-circle"} style={{ fontSize: '1.2rem' }}></i>
               </button>
             </div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.35rem', opacity: 0.7, fontSize: '0.85rem' }}>
            <span><i className="ph ph-tag"></i> Ticket: {state.requirements.find(r => r.id === tc.requirementId)?.code || 'N/A'}</span>
            <span><i className="ph ph-clock-counter-clockwise"></i> Tempo Acumulado (Histórico): {formatTime(tc?.executions?.reduce((acc, e) => acc + (e.executionTime || 0), 0) || 0)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" onClick={() => setCurrentView('testCases')} title="Sair sem fechar o timer">Voltar</button>
        </div>
      </div>
      
      <div style={{ maxWidth: '800px' }}>
        {localSteps.map((st, i) => (
          <div key={i} className="stat-card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Passo {i+1}: {st.action}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Esperado: {st.expected}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn" onClick={() => handleStatusChange(i, 'passed')} style={{ background: st.status === 'passed' ? 'var(--accent-success)' : 'transparent', border: '1px solid var(--accent-success)', color: st.status === 'passed' ? 'white' : 'var(--accent-success)' }}><i className="ph ph-check"></i></button>
                <button className="btn" onClick={() => handleStatusChange(i, 'failed')} style={{ background: st.status === 'failed' ? 'var(--accent-danger)' : 'transparent', border: '1px solid var(--accent-danger)', color: st.status === 'failed' ? 'white' : 'var(--accent-danger)' }}><i className="ph ph-x"></i></button>
              </div>
            </div>
            {st.status !== 'pending' && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--surface-solid)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {(st.status === 'failed' || st.status === 'passed') && (
                  <>
                    <label className="form-label" style={{ color: st.status === 'failed' ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                      {st.status === 'failed' ? 'Motivo da Falha / Log' : 'Observação (Opcional)'}
                    </label>
                    <textarea className="form-textarea" rows="2" placeholder={st.status === 'failed' ? "Descreva o que aconteceu de errado..." : "Adicione alguma observação (opcional)..."} defaultValue={st.failureLog || ''} onBlur={e => updateStep(i, 'failureLog', e.target.value)} style={{ marginBottom: '1rem' }} />
                  </>
                )}
                
                <label className="form-label">Anexar Evidência (Imagens)</label>
                <input type="file" accept="image/*" multiple onChange={(e) => handleFileUpload(i, e)} style={{ display: 'block', marginBottom: '0.5rem' }} />
                
                {st.evidences && st.evidences.length > 0 && (
                  <div className="evidence-container" style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {st.evidences.map((ev, evIdx) => (
                      <div key={evIdx} className="evidence-wrapper" style={{ position: 'relative' }}>
                        <img src={ev} alt="Evidência" className="evidence-img" style={{ maxHeight: '150px', borderRadius: '4px', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => setFullScreenImage(ev)} title="Clique para ampliar" />
                        <button className="btn btn-danger" onClick={() => removeEvidence(i, evIdx)} style={{ position: 'absolute', top: '-8px', right: '-8px', padding: '0.4rem', borderRadius: '50%', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Remover Foto"><i className="ph ph-trash" style={{ fontSize: '1rem' }}></i></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <button className="btn btn-primary" onClick={finish} style={{ width: '100%', padding: '1.25rem', marginTop: '1rem' }}>Finalizar Execução</button>
      </div>
    </div>
  );
};

// --- View: Bugs ---
const Bugs = () => {
  const { state, setCurrentView, setSearchQuery, setState, logAction } = useApp();
  const [filter, setFilter] = useState('Abertos');
  const [expandedBug, setExpandedBug] = useState(null);

  const activeBugs = state.bugs.filter(b => {
    if (filter === 'Abertos') return b.status === 'Aberto';
    if (filter === 'Fechados') return b.status === 'Fechado';
    return true; // Todos
  });

  const toggleStatus = async (bugId, currentStatus, tcId) => {
    const newStatus = currentStatus === 'Aberto' ? 'Fechado' : 'Aberto';
    await setDoc(doc(db, 'bugs', bugId), { status: newStatus }, { merge: true });
    if (tcId) logAction(newStatus === 'Fechado' ? 'Fechou o Bug' : 'Reabriu o Bug', tcId);
  };



  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Central de Bugs</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${filter === 'Abertos' ? 'btn-primary' : 'btn-soft'}`} onClick={() => setFilter('Abertos')}>Abertos</button>
          <button className={`btn ${filter === 'Fechados' ? 'btn-primary' : 'btn-soft'}`} onClick={() => setFilter('Fechados')}>Fechados</button>
          <button className={`btn ${filter === 'Todos' ? 'btn-primary' : 'btn-soft'}`} onClick={() => setFilter('Todos')}>Todos</button>
        </div>
      </div>
      
      <div className="stat-card" style={{ padding: 0, marginTop: '2rem' }}>
        <table className="data-table">
          <thead><tr><th>Ticket</th><th>Título</th><th>Tempo Execução</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {activeBugs.map(b => {
              const tc = state.testCases.find(t => t.id === b.caseId);
              const req = tc ? state.requirements.find(r => r.id === tc.requirementId) : null;
              const ticketCode = req ? req.code : 'N/A';
              const isExpanded = expandedBug === b.id;
              
              return (
                <React.Fragment key={b.id}>
                  <tr style={{ background: isExpanded ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
                    <td style={{ fontWeight: 900, color: 'var(--accent-primary)', fontFamily: 'monospace' }} title={`Bug ID: ${b.id}`}>{ticketCode}</td>
                    <td style={{ fontWeight: 600 }}>{b.title}</td>
                    <td>{tc && tc.executionTime !== undefined ? formatTime(tc.executionTime) : (b.executionTime !== undefined ? formatTime(b.executionTime) : '-')}</td>
                    <td><Badge>{b.status}</Badge></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {(() => {
                          const canClose = state.user?.name && (
                            b.createdBy === state.user.name ||
                            tc?.createdBy === state.user.name ||
                            req?.createdBy === state.user.name
                          );
                          return (
                            <button className="btn btn-soft" onClick={() => {
                              if (!canClose) {
                                alert('Acesso negado: Você só pode fechar/reabrir bugs gerados pelos seus testes ou tickets.');
                                return;
                              }
                              toggleStatus(b.id, b.status, tc?.id);
                            }} title={!canClose ? "Acesso negado" : (b.status === 'Aberto' ? 'Fechar Bug' : 'Reabrir Bug')} style={{ opacity: canClose ? 1 : 0.4, cursor: canClose ? 'pointer' : 'not-allowed' }}>
                              <i className={b.status === 'Aberto' ? 'ph ph-check-circle' : 'ph ph-arrow-counter-clockwise'} style={{ color: b.status === 'Aberto' ? 'var(--accent-success)' : 'var(--text-secondary)' }}></i>
                            </button>
                          );
                        })()}
                        <button className="btn btn-soft" onClick={() => setExpandedBug(isExpanded ? null : b.id)} title="Ver Detalhes/Logs">
                          <i className={`ph ph-caret-${isExpanded ? 'up' : 'down'}`}></i> Logs
                        </button>
                        <button className="btn btn-soft" onClick={() => {
                          if (tc) {
                            setSearchQuery(tc.title);
                            setCurrentView('testCases');
                          }
                        }} title="Ver em Casos de Teste">
                          <i className="ph ph-arrow-square-out"></i> Abrir
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && tc && (
                    <tr>
                      <td colSpan="5" style={{ padding: 0 }}>
                        <div style={{ background: 'var(--bg-color)', padding: '1.5rem', borderBottom: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)' }}>
                          <h4 style={{ margin: '0 0 1rem 0', color: 'var(--accent-danger)' }}><i className="ph ph-warning-circle"></i> Tabela de Logs de Falha</h4>
                          {tc.steps.filter(st => st.status === 'failed').length === 0 ? (
                            <p style={{ opacity: 0.6 }}>Nenhuma falha detalhada encontrada nos passos deste caso de teste.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              {tc.steps.filter(st => st.status === 'failed').map((st, i) => (
                                <div key={i} style={{ background: 'var(--surface-solid)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Ação: {st.action}</div>
                                  <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Esperado: {st.expected}</div>
                                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '4px', borderLeft: '3px solid var(--accent-danger)', marginBottom: '1rem' }}>
                                    <strong>Log da Falha:</strong> {st.failureLog || 'Sem log fornecido.'}
                                  </div>
                                  {st.evidences && st.evidences.length > 0 && (
                                    <div>
                                      <strong>Evidências:</strong><br/>
                                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                        {st.evidences.map((ev, evIdx) => (
                                          <img key={evIdx} src={ev} alt="Evidência" onClick={() => {
                                            const newWindow = window.open();
                                            if (newWindow) {
                                              newWindow.document.write(`<body style="margin:0;display:flex;justify-content:center;align-items:center;background:#0e1117;min-height:100vh;"><img id="ev-img" style="max-width:100%;max-height:100vh;" /></body>`);
                                              newWindow.document.getElementById('ev-img').src = ev;
                                              newWindow.document.title = "Evidência";
                                              newWindow.document.close();
                                            }
                                          }} style={{ maxHeight: '150px', borderRadius: '4px', border: '1px solid var(--border-color)', cursor: 'pointer' }} title="Clique para abrir numa nova guia" />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {activeBugs.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>Nenhum bug encontrado.</td></tr>}
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

  const [filterUser, setFilterUser] = useState('');
  const [filterReq, setFilterReq] = useState('');

  const uniqueUsers = [...new Set(state.requirements.map(r => r.createdBy).filter(Boolean))];

  let allSteps = [];
  state.testCases.forEach(tc => {
    const requirement = state.requirements.find(r => r.id === tc.requirementId);
    
    if (filterReq && requirement?.id !== filterReq) return;
    if (filterUser && requirement?.createdBy !== filterUser) return;

    tc.steps.forEach((st, i) => {
      allSteps.push({
        tcId: tc.id,
        tcTitle: tc.title,
        stepIdx: i,
        step: st
      });
    });
  });

  const updateStepStatus = async (tcId, stepIdx, field, value) => {
    const tc = state.testCases.find(t => t.id === tcId);
    if (!tc) return;
    const newSteps = JSON.parse(JSON.stringify(tc.steps));
    newSteps[stepIdx][field] = value;
    
    // Atualização otimista
    setState(s => {
      const newTCs = [...s.testCases];
      const tcIndex = newTCs.findIndex(t => t.id === tcId);
      newTCs[tcIndex].steps = newSteps;
      return { ...s, testCases: newTCs };
    });

    const hasFail = newSteps.some(st => st.status === 'failed');
    const hasPass = newSteps.some(st => st.status === 'passed');
    const allPass = newSteps.length > 0 && newSteps.every(st => st.status === 'passed');
    const allPending = newSteps.every(st => st.status === 'pending');
    
    let newStatus = tc.status;
    if (allPending) newStatus = 'Não executado';
    else if (allPass) newStatus = 'Aprovado';
    else if (hasFail) newStatus = 'Reprovado';
    else if (hasPass) newStatus = 'Parcial';

    try {
      await setDoc(doc(db, 'testCases', tcId), { steps: newSteps, status: newStatus }, { merge: true });
    } catch (err) {
      console.error('Erro ao salvar no Firestore', err);
    }
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
          <div className="no-print" style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccc', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <select className="form-select" value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ width: 'auto', minWidth: '200px', color: '#333', background: '#f8fafc', border: '1px solid #ccc' }}>
                <option value="">Todos os Usuários</option>
                {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <select className="form-select" value={filterReq} onChange={e => setFilterReq(e.target.value)} style={{ width: 'auto', minWidth: '250px', color: '#333', background: '#f8fafc', border: '1px solid #ccc' }}>
                <option value="">Todos os Tickets</option>
                {state.requirements.map(r => <option key={r.id} value={r.id}>{r.code} - {r.title}</option>)}
              </select>
              <button className="btn btn-secondary" onClick={() => { setFilterUser(''); setFilterReq(''); }} style={{ color: '#333', background: '#e2e8f0', border: '1px solid #ccc' }} title="Limpar Filtros">
                <i className="ph ph-eraser"></i> Limpar Filtro
              </button>
            </div>
            <button className="btn btn-primary" onClick={exportPDF}>Exportar PDF</button>
          </div>
          <div className="spreadsheet-table-inner" style={{ overflow: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px' }}>
              <thead style={{ background: 'var(--accent-primary)', color: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
                 <tr>
                 <th style={{ border: '1px solid #ccc', padding: '6px 8px', width: '50px', textAlign: 'center' }}>STEPS</th>
                 <th style={{ border: '1px solid #ccc', padding: '6px 8px', textAlign: 'center' }}>Casos de Teste</th>
                 <th style={{ border: '1px solid #ccc', padding: '6px 8px', width: '20%', textAlign: 'center' }}>Passos de Execução</th>
                 <th style={{ border: '1px solid #ccc', padding: '6px 8px', width: '15%', textAlign: 'center' }}>Resultado Esperado</th>
                 <th style={{ border: '1px solid #ccc', padding: '6px 8px', width: '15%', textAlign: 'center' }}>Resultado Atual</th>
                 <th style={{ border: '1px solid #ccc', padding: '6px 8px', width: '100px', textAlign: 'center' }}>Status</th>
               </tr>
            </thead>
            <tbody>
              {allSteps.map((row, index) => {
                 const isPendente = row.step.status === 'pending';
                 const isOk = row.step.status === 'passed';
                 const isFalha = row.step.status === 'failed';
                 
                 const tc = state.testCases.find(t => t.id === row.tcId);
                 const ticket = state.requirements.find(r => r.id === tc?.requirementId);
                 const tcOwner = tc?.createdBy || ticket?.createdBy;
                 const canExecute = state.user?.name && (tcOwner === state.user.name || tc?.linkedUser === state.user.name || tc?.linkedUsers?.includes(state.user.name));

                 return (
                 <tr key={`${row.tcId}-${row.stepIdx}`} style={{ background: index % 2 === 0 ? '#eef8fc' : '#fff', color: '#333', opacity: canExecute ? 1 : 0.6 }}>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'center', fontWeight: row.tcTitle ? 'bold' : 'normal' }}>{row.tcTitle}</td>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'center' }}>{row.step.action}</td>
                    <td style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'center' }}>{row.step.expected}</td>
                    <td style={{ border: '1px solid #ccc', padding: '0' }}>
                        {isFalha ? (
                          <input value={row.step.actualResult || ''} onChange={(e) => updateStepStatus(row.tcId, row.stepIdx, 'actualResult', e.target.value)} disabled={!canExecute} style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', padding: '6px 8px', color: '#333', outline: 'none', textAlign: 'center', cursor: canExecute ? 'text' : 'not-allowed' }} placeholder="Descreva a falha (Obrigatório)" />
                        ) : isOk ? (
                          <div style={{ padding: '6px 8px', color: '#10b981', textAlign: 'center', fontStyle: 'italic' }}>Conforme esperado</div>
                        ) : (
                          <div style={{ padding: '6px 8px', color: '#cbd5e1', textAlign: 'center' }}>-</div>
                        )}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '0' }}>
                        <select value={row.step.status} onChange={(e) => updateStepStatus(row.tcId, row.stepIdx, 'status', e.target.value)} disabled={!canExecute} style={{ width: '100%', border: 'none', background: 'transparent', padding: '4px', fontWeight: 'bold', outline: 'none', textAlign: 'center', color: isOk ? '#10b981' : isFalha ? '#ef4444' : '#64748b', cursor: canExecute ? 'pointer' : 'not-allowed' }} title={canExecute ? '' : 'Sem permissão para editar'}>
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (isForgotPassword) {
        await sendPasswordResetEmail(auth, email);
        setMessage('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      } else if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        // Force refresh state via auth listener
        window.location.reload();
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
      <div className="stat-card" style={{ width: '100%', maxWidth: '440px', padding: '3rem', textAlign: 'center', background: 'var(--surface-solid)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', border: '1px solid var(--glass-border)', margin: '1.5rem' }}>
        <Logo90Ti style={{ height: '60px', marginBottom: '1.5rem', display: 'inline-block' }} />
        <h2 style={{ marginBottom: '2rem' }}>
          {isForgotPassword ? 'Recuperar Senha' : (isRegister ? 'Criar Conta' : 'Login Test Manager')}
        </h2>
        {error && <div style={{ color: 'var(--accent-danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
        {message && <div style={{ color: 'var(--accent-success)', marginBottom: '1rem', fontSize: '0.9rem' }}>{message}</div>}
        
        {!isForgotPassword && (
          <>
            <button className="btn btn-soft" onClick={handleGoogleLogin} style={{ width: '100%', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'white', color: '#444', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' }}>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px', height: '18px' }} />
              Continuar com o Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', opacity: 0.5 }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
              <span style={{ fontSize: '0.8rem' }}>OU</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!isForgotPassword && isRegister && <input type="text" className="form-input" placeholder="Seu Nome" value={name} onChange={e => setName(e.target.value)} required />}
          <input type="email" className="form-input" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} required />
          {!isForgotPassword && <input type="password" className="form-input" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required />}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            {isForgotPassword ? 'Enviar E-mail' : (isRegister ? 'Cadastrar' : 'Entrar')}
          </button>
        </form>
        
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.9rem' }}>
          {isForgotPassword ? (
            <button className="btn" onClick={(e) => { e.preventDefault(); setIsForgotPassword(false); setError(''); setMessage(''); }} style={{ width: '100%', background: 'var(--surface-solid)', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', color: 'var(--accent-primary)', padding: '0.8rem' }}>
              Voltar para o Login
            </button>
          ) : (
            <>
              {!isRegister && (
                <button className="btn" onClick={(e) => { e.preventDefault(); setIsForgotPassword(true); setError(''); setMessage(''); }} style={{ width: '100%', background: 'var(--surface-solid)', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', color: 'var(--text-secondary)', padding: '0.8rem' }}>
                  Esqueci minha senha
                </button>
              )}
              <button className="btn" onClick={(e) => { e.preventDefault(); setIsRegister(!isRegister); setError(''); setMessage(''); }} style={{ width: '100%', background: 'var(--surface-solid)', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', color: 'var(--accent-primary)', padding: '0.8rem' }}>
                {isRegister ? 'Já tenho uma conta' : 'Criar nova conta'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ProfileView = () => {
  const { state } = useApp();
  const [name, setName] = useState(state.user?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [photoURL, setPhotoURL] = useState(state.user?.photoURL || '');
  const [loading, setLoading] = useState(false);

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await compressImage(file, 200);
      setPhotoURL(base64);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let updated = false;
      if (name !== state.user?.name || photoURL !== state.user?.photoURL) {
        await updateProfile(auth.currentUser, { displayName: name, photoURL: photoURL });
        updated = true;
      }
      if (newPassword) {
        await updatePassword(auth.currentUser, newPassword);
        updated = true;
        setNewPassword('');
      }
      
      if (updated) {
        alert('Perfil atualizado com sucesso! Recarregue a página para aplicar em todos os menus.');
      } else {
        alert('Nenhuma alteração para salvar.');
      }
    } catch (e) {
      alert(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="animate-fade" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h3 style={{ marginBottom: '2rem' }}>Meu Perfil</h3>
      <div className="stat-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid var(--border-color)' }}>
            {photoURL ? <img src={photoURL} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="ph ph-user" style={{ fontSize: '2.5rem', color: 'var(--text-secondary)' }}></i>}
          </div>
          <div>
            <label className="btn btn-soft" style={{ cursor: 'pointer', display: 'inline-flex' }}>
              <i className="ph ph-camera"></i> Alterar Foto
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            </label>
          </div>
        </div>

        <label className="form-label">Nome de Exibição (Aparece nos Tickets)</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: '1rem' }} />
        <label className="form-label">E-mail</label>
        <input className="form-input" value={state.user?.email || ''} disabled style={{ marginBottom: '1rem', opacity: 0.5 }} />
        
        <label className="form-label">Nova Senha (Deixe em branco para manter a atual)</label>
        <input type="password" className="form-input" placeholder="Digite a nova senha" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ marginBottom: '2rem' }} />
        
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
};

const Sidebar = () => {
  const { currentView, setCurrentView, state, setState, setSidebarOpen, isSidebarOpen, setSearchQuery } = useApp();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const menu = [
    { id: 'dashboard', label: 'Dashboard', icon: 'ph-fill ph-chart-pie' },
    { id: 'requirements', label: 'Tickets', icon: 'ph ph-scroll' },
    { id: 'testCases', label: 'Casos de Teste', icon: 'ph ph-test-tube' },
    { id: 'spreadsheet', label: 'Planilha', icon: 'ph ph-table' },
    { id: 'bugs', label: 'Bugs', icon: 'ph ph-bug' },
    { id: 'profile', label: 'Meu Perfil', icon: 'ph ph-user' }
  ];
  return (
    <aside className={`sidebar ${isSidebarOpen ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', marginBottom: '2.5rem' }}>
        {!isCollapsed && <Logo90Ti style={{ height: '28px' }} />}
        <button className="btn-icon" onClick={() => setIsCollapsed(!isCollapsed)} title="Alternar Menu">
          <i className="ph ph-list"></i>
        </button>
      </div>
      <nav className="nav-menu">
        {menu.map(m => (
          <a key={m.id} className={`nav-item ${currentView === m.id ? 'active' : ''}`} onClick={() => { setCurrentView(m.id); setSearchQuery(''); setSidebarOpen(false); }} title={isCollapsed ? m.label : ''}>
            <i className={m.icon} style={{ fontSize: '1.2rem', minWidth: '1.2rem' }}></i> 
            {!isCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{m.label}</span>}
          </a>
        ))}
      </nav>
      <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
        <a className="nav-item" onClick={() => signOut(auth)} title={isCollapsed ? "Sair" : ""} style={{ color: 'var(--accent-danger)' }}>
          <i className="ph ph-sign-out" style={{ fontSize: '1.2rem', minWidth: '1.2rem' }}></i>
          {!isCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Sair</span>}
        </a>
      </div>
    </aside>
  );
};

const Header = () => {
  const { searchQuery, setSearchQuery, state, setState, setSidebarOpen, currentView } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="header" style={{ position: 'relative', zIndex: 100 }}>
      <button className="menu-toggle" onClick={() => setSidebarOpen(true)}><i className="ph ph-list"></i></button>
      
      <div style={{ marginLeft: '1rem', fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--text-primary)' }} className="hide-mobile">
        {currentView === 'dashboard' && 'Dashboard'}
        {currentView === 'requirements' && 'Tickets'}
        {currentView === 'testCases' && 'Casos de Teste'}
        {currentView === 'spreadsheet' && 'Planilha'}
        {currentView === 'bugs' && 'Central de Bugs'}
        {currentView === 'profile' && 'Meu Perfil'}
        {currentView === 'runner' && 'Execução de Teste'}
      </div>

      {currentView === 'testCases' ? (
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px', marginLeft: '2rem' }}>
          <i className="ph ph-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }}></i>
          <input type="text" className="form-input" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }} placeholder="Busca Titulo..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {searchQuery && (
            <button className="btn-icon" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', padding: '4px', background: 'transparent', color: 'var(--text-secondary)' }} onClick={() => setSearchQuery('')}>
              <i className="ph ph-x"></i>
            </button>
          )}
        </div>
      ) : (
        <div style={{ flex: 1 }}></div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ textAlign: 'right', fontSize: '0.8rem' }} className="hide-mobile">
          <div style={{ fontWeight: 700 }}>{state.user?.name}</div>
          <div style={{ opacity: 0.5 }}>{state.user?.role}</div>
        </div>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <div 
            style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, cursor: 'pointer', color: 'white', overflow: 'hidden' }}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {state.user?.photoURL ? <img src={state.user.photoURL} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : state.user?.name?.[0]}
          </div>
          {menuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'var(--surface-solid)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', padding: '0.25rem', minWidth: '100px', zIndex: 9999, display: 'flex', justifyContent: 'center' }}>
              <button 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.4rem 0', fontSize: '0.8rem', background: 'transparent', color: 'var(--accent-danger)', border: 'none', cursor: 'pointer', fontWeight: 600, borderRadius: '6px', transition: 'background 0.2s' }} 
                onClick={() => signOut(auth)}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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

const FloatingTimers = () => {
  const { activeTimers, setActiveTimers, currentView, viewParams, setCurrentView, setViewParams } = useApp();
  const entries = Object.entries(activeTimers).filter(([id]) => {
     return !(currentView === 'runner' && viewParams === id);
  });
  if (entries.length === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 9999 }}>
      {entries.map(([tcId, timer]) => (
        <div key={tcId} style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', position: 'relative' }}>
          <button onClick={() => {
            setActiveTimers(prev => {
              const next = { ...prev };
              delete next[tcId];
              return next;
            });
            localStorage.removeItem(`test_manager_runner_${tcId}`);
          }} style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--accent-danger)', border: 'none', borderRadius: '50%', padding: '0.3rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} title="Fechar Timer e Cancelar">
            <i className="ph ph-x" style={{ fontSize: '0.8rem', color: 'white', fontWeight: 'bold' }}></i>
          </button>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Execução Ativa</div>
            <div style={{ fontWeight: 'bold' }}>{timer.title}</div>
          </div>
          <div style={{ background: 'var(--accent-primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="ph ph-timer"></i> {formatTime(timer.elapsedTime)}
            <button onClick={() => {
              if (!timer.isRunning) {
                const isAnyOtherRunning = Object.entries(activeTimers).some(([id, t]) => id !== tcId && t.isRunning);
                if (isAnyOtherRunning) {
                  alert('Você já possui outro caso de teste em execução. Pause ou finalize-o antes de iniciar este.');
                  return;
                }
              }
              setActiveTimers(prev => ({...prev, [tcId]: {...prev[tcId], isRunning: !prev[tcId].isRunning}}))
            }} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>
              <i className={timer.isRunning ? "ph ph-pause-circle" : "ph ph-play-circle"} style={{ fontSize: '1.2rem' }}></i>
            </button>
          </div>
          <button className="btn btn-soft" onClick={() => { setViewParams(tcId); setCurrentView('runner'); }} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Abrir</button>
        </div>
      ))}
    </div>
  );
};

const Main = () => {
  const { currentView, state, fullScreenImage, setFullScreenImage } = useApp();
  if (!state.user) return <LoginView />;
  const Content = { dashboard: Dashboard, requirements: Requirements, testCases: TestCases, runner: Runner, bugs: Bugs, spreadsheet: SpreadsheetView, profile: ProfileView }[currentView] || Dashboard;
  return (
    <div id="app">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="content-body"><Content /></main>
      </div>
      <FloatingTimers />
      {!!state.user && !!fullScreenImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setFullScreenImage(null)}>
          <button style={{ position: 'absolute', top: '20px', right: '30px', background: 'transparent', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer' }} onClick={() => setFullScreenImage(null)}><i className="ph ph-x"></i></button>
          <img src={fullScreenImage} alt="Evidência Ampliada" style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', cursor: 'zoom-out' }} />
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('app')).render(<AppProvider><Main /></AppProvider>);
