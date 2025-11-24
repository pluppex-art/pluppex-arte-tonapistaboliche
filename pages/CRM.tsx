
import React, { useEffect, useState } from 'react';
import { db, cleanPhone } from '../services/mockBackend';
import { Client, Reservation, FunnelStage, User, UserRole } from '../types';
import { FUNNEL_STAGES } from '../constants';
import { Search, MessageCircle, Calendar, Tag, Plus, Users, Loader2, LayoutList, Kanban as KanbanIcon, GripVertical, Pencil, Save, X } from 'lucide-react';

const CRM: React.FC = () => {
  const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('LIST');
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});

  useEffect(() => {
    const stored = localStorage.getItem('tonapista_auth');
    if (stored) setCurrentUser(JSON.parse(stored));
  }, []);

  // Permission Check
  const canEditClient = currentUser?.role === UserRole.ADMIN || currentUser?.perm_edit_client;

  const fetchClients = async () => {
    setLoading(true);
    const data = await db.clients.getAll();
    setClients(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (selectedClient) {
        const allRes = await db.reservations.getAll();
        
        // Filter: Client is MAIN responsible OR Client is listed in GUESTS/Second Responsible
        const history = allRes.filter(r => {
            const isMain = r.clientId === selectedClient.id;
            const isGuest = r.guests?.some(g => cleanPhone(g.phone) === cleanPhone(selectedClient.phone));
            return isMain || isGuest;
        });

        // Ordena por data (mais recente primeiro)
        const sortedHistory = history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setClientHistory(sortedHistory);
      }
    };
    fetchHistory();
  }, [selectedClient]);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${clean}`, '_blank');
  };

  // --- KANBAN LOGIC ---
  const handleDragStart = (e: React.DragEvent, clientId: string) => {
    if (!canEditClient) return;
    e.dataTransfer.setData('clientId', clientId);
  };

  const handleDrop = async (e: React.DragEvent, newStage: FunnelStage) => {
    e.preventDefault();
    if (!canEditClient) {
        alert("Sem permissão para editar status do cliente.");
        return;
    }

    const clientId = e.dataTransfer.getData('clientId');
    if (!clientId) return;

    // Otimistic Update
    const updatedClients = clients.map(c => {
        if (c.id === clientId) return { ...c, funnelStage: newStage };
        return c;
    });
    setClients(updatedClients);

    // DB Update
    await db.clients.updateStage(clientId, newStage);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  const getClientsByStage = (stage: FunnelStage) => {
      return filteredClients.filter(c => (c.funnelStage || FunnelStage.NOVO) === stage);
  };

  // --- EDIT LOGIC ---
  const startEditing = () => {
      if (!canEditClient) return;
      if (!selectedClient) return;
      setEditForm({
          name: selectedClient.name,
          email: selectedClient.email,
          phone: selectedClient.phone,
          tags: selectedClient.tags // Keep as array
      });
      setIsEditing(true);
  };

  const handleSaveClient = async () => {
      if (!canEditClient) return;
      if (!selectedClient || !editForm) return;
      
      const updatedClient = {
          ...selectedClient,
          ...editForm
      };

      await db.clients.update(updatedClient);
      
      // Refresh local state
      setSelectedClient(updatedClient);
      fetchClients(); // Refresh list
      setIsEditing(false);
  };

  return (
    <div className="h-full flex flex-col pb-20 md:pb-0">
      
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">Gestão de Clientes</h1>
            <span className="bg-slate-800 border border-slate-700 text-neon-blue px-3 py-1 rounded-full text-sm font-bold shadow-sm flex items-center gap-1">
               <Users size={14} />
               {loading ? '...' : clients.length}
            </span>
          </div>
          
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
             <button 
               onClick={() => setViewMode('LIST')}
               className={`px-4 py-2 rounded flex items-center gap-2 text-sm font-bold transition ${viewMode === 'LIST' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                <LayoutList size={18} /> Lista
             </button>
             <button 
               onClick={() => setViewMode('KANBAN')}
               className={`px-4 py-2 rounded flex items-center gap-2 text-sm font-bold transition ${viewMode === 'KANBAN' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                <KanbanIcon size={18} /> Funil
             </button>
          </div>
      </div>

      {viewMode === 'LIST' ? (
          // --- VIEW: LIST ---
          <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
                {/* Contact List */}
                <div className={`${selectedClient ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-1/3 bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden`}>
                    <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input 
                        type="text" 
                        placeholder="Buscar cliente..."
                        className="w-full bg-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-neon-blue"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-neon-blue"/></div>
                    ) : filteredClients.map(client => (
                        <div 
                        key={client.id}
                        onClick={() => { setSelectedClient(client); setIsEditing(false); }}
                        className={`p-4 border-b border-slate-700 cursor-pointer hover:bg-slate-700/50 transition ${selectedClient?.id === client.id ? 'bg-slate-700/80 border-l-4 border-l-neon-blue' : ''}`}
                        >
                        <div className="flex justify-between items-start">
                            <h3 className="font-bold text-white">{client.name}</h3>
                            <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-600">
                                {client.funnelStage || 'Novo'}
                            </span>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{client.phone}</p>
                        </div>
                    ))}
                    </div>
                </div>

                {/* Detail View */}
                <div className={`${!selectedClient ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden`}>
                    {selectedClient ? (
                    <>
                        {/* Detail Header */}
                        <div className="p-6 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                            <div>
                                <button onClick={() => setSelectedClient(null)} className="md:hidden text-slate-400 text-sm mb-2">&larr; Voltar</button>
                                {!isEditing ? (
                                    <>
                                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                            {selectedClient.name}
                                            {canEditClient && (
                                                <button onClick={startEditing} className="text-slate-500 hover:text-white transition p-1"><Pencil size={16}/></button>
                                            )}
                                        </h2>
                                        <p className="text-slate-400">{selectedClient.email || 'Sem e-mail'}</p>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold text-white">Editando Cliente</h2>
                                    </div>
                                )}
                            </div>
                            
                            {!isEditing ? (
                                <button 
                                    onClick={() => openWhatsApp(selectedClient.phone)}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                                >
                                    <MessageCircle size={18} /> WhatsApp
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setIsEditing(false)} 
                                        className="bg-slate-700 text-white px-3 py-2 rounded hover:bg-slate-600"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button 
                                        disabled={!canEditClient}
                                        onClick={handleSaveClient} 
                                        className="bg-neon-blue text-white px-3 py-2 rounded hover:bg-blue-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Save size={18} /> Salvar
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            
                            {isEditing ? (
                                // --- EDIT FORM ---
                                <div className="space-y-4 animate-fade-in bg-slate-900/30 p-4 rounded-lg border border-slate-700">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Nome Completo</label>
                                        <input 
                                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"
                                            value={editForm.name}
                                            onChange={e => setEditForm({...editForm, name: e.target.value})}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Telefone</label>
                                            <input 
                                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"
                                                value={editForm.phone}
                                                onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">E-mail</label>
                                            <input 
                                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"
                                                value={editForm.email}
                                                onChange={e => setEditForm({...editForm, email: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Tags (separadas por vírgula)</label>
                                        <input 
                                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"
                                            value={editForm.tags?.join(', ')}
                                            onChange={e => setEditForm({...editForm, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                                            placeholder="Ex: VIP, Empresa, Aniversário"
                                        />
                                    </div>
                                </div>
                            ) : (
                                // --- VIEW DETAILS ---
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                                            <p className="text-slate-500 text-xs uppercase font-bold">Telefone</p>
                                            <p className="text-white font-mono">{selectedClient.phone}</p>
                                        </div>
                                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                                            <p className="text-slate-500 text-xs uppercase font-bold">Estágio do Funil</p>
                                            <p className="text-neon-orange font-bold">{selectedClient.funnelStage || 'Novo'}</p>
                                        </div>
                                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                                            <p className="text-slate-500 text-xs uppercase font-bold">Último contato</p>
                                            <p className="text-white">{new Date(selectedClient.lastContactAt).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><Tag size={18} className="text-neon-blue"/> Tags</h3>
                                        <div className="flex flex-wrap gap-2">
                                        {selectedClient.tags.map(t => (
                                            <span key={t} className="bg-neon-blue/10 text-neon-blue border border-neon-blue/30 px-3 py-1 rounded-full text-sm">
                                            {t}
                                            </span>
                                        ))}
                                        {selectedClient.tags.length === 0 && <span className="text-slate-500 italic text-sm">Sem tags.</span>}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div>
                                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    <Calendar size={18} className="text-neon-orange"/> Histórico de Reservas ({clientHistory.length})
                                </h3>
                                <div className="space-y-2">
                                {clientHistory.length === 0 ? (
                                    <p className="text-slate-500 italic">Nenhuma reserva encontrada.</p>
                                ) : (
                                    clientHistory.map(h => {
                                        const isMain = h.clientId === selectedClient.id;
                                        return (
                                            <div key={h.id} className="flex items-center justify-between bg-slate-700/30 p-3 rounded-lg border border-slate-700">
                                                <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-medium">{new Date(h.date).toLocaleDateString('pt-BR')}</span>
                                                    <span className="text-slate-400">|</span>
                                                    <span className="text-slate-300">{h.eventType}</span>
                                                </div>
                                                {!isMain && (
                                                    <span className="text-[10px] uppercase text-neon-blue font-bold bg-neon-blue/10 px-1 rounded mt-1 inline-block">Segundo Responsável</span>
                                                )}
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-xs px-2 py-1 rounded block mb-1 ${h.status === 'Confirmada' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-300'}`}>
                                                        {h.status}
                                                    </span>
                                                    <span className="text-xs text-slate-500">{h.laneCount} Pista(s)</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                </div>
                            </div>

                        </div>
                    </>
                    ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <Users size={64} className="mb-4 opacity-20" />
                        <p>Selecione um cliente para ver detalhes</p>
                    </div>
                    )}
                </div>
          </div>
      ) : (
          // --- VIEW: KANBAN ---
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
                {loading ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>
                ) : (
                    <div className="flex gap-4 h-full min-w-[1200px] pb-4">
                        {FUNNEL_STAGES.map((stage) => {
                            const stageClients = getClientsByStage(stage);
                            return (
                                <div 
                                    key={stage} 
                                    className="flex-1 min-w-[280px] bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, stage)}
                                >
                                    {/* Column Header */}
                                    <div className="p-4 border-b border-slate-700 font-bold text-slate-300 flex justify-between items-center sticky top-0 bg-slate-800 rounded-t-xl z-10">
                                        <span>{stage}</span>
                                        <span className="bg-slate-700 text-xs px-2 py-1 rounded-full text-slate-400">
                                            {stageClients.length}
                                        </span>
                                    </div>

                                    {/* Column Content */}
                                    <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                                        {stageClients.map(client => (
                                        <div
                                            key={client.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, client.id)}
                                            className={`bg-slate-700 p-4 rounded-lg shadow-sm border border-slate-600 transition group relative ${canEditClient ? 'cursor-grab active:cursor-grabbing hover:border-neon-blue hover:shadow-md' : 'cursor-default'}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-white">{client.name}</h4>
                                                {canEditClient && (
                                                    <GripVertical className="text-slate-500 opacity-0 group-hover:opacity-100 transition" size={16} />
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400">{client.phone}</p>
                                            <p className="text-xs text-slate-500 mt-2">
                                                Último contato: {new Date(client.lastContactAt).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
          </div>
      )}
    </div>
  );
};

export default CRM;
