
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, cleanPhone } from '../services/mockBackend';
import { Integrations } from '../services/integrations';
import { EventType, AppSettings, ReservationStatus, Guest, User, PaymentStatus, Reservation, FunnelStage } from '../types';
import { EVENT_TYPES, INITIAL_SETTINGS } from '../constants';
import { CheckCircle, Calendar as CalendarIcon, Clock, Users, ChevronRight, DollarSign, ChevronLeft, Lock, LayoutDashboard, Loader2, UserPlus, Mail, Phone, User as UserIcon, AlertCircle, XCircle, ShieldCheck, CreditCard, ArrowRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Adicionado passo extra "Pagamento"
const steps = ['Data', 'Configuração & Horário', 'Seus Dados', 'Resumo', 'Pagamento'];

const PublicBooking: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [imgError, setImgError] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [existingReservations, setExistingReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Draft State - Store created IDs to pass to checkout
  const [createdReservationIds, setCreatedReservationIds] = useState<string[]>([]);

  // Form State
  const [selectedDate, setSelectedDate] = useState('');
  
  // CHANGED: Multi-select support
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  
  // New Form Data Structure
  const [formData, setFormData] = useState({
    people: 6, 
    lanes: 1,
    type: EventType.JOGO_NORMAL,
    obs: '',
    
    // Main Responsible
    name: '',
    whatsapp: '',
    email: '',

    // Second Responsible
    hasSecondResponsible: false,
    secondName: '',
    secondWhatsapp: '',
    secondEmail: ''
  });

  // Calendar View State
  const [viewDate, setViewDate] = useState(new Date());

  // Helper to determine price based on date (Dynamic Price from Settings)
  const getPricePerHour = () => {
      if (!selectedDate || !settings) return INITIAL_SETTINGS.weekdayPrice;
      const [y, m, d] = selectedDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const day = date.getDay();
      // Sexta (5), Sábado (6), Domingo (0) -> Weekend Price
      if (day === 0 || day === 5 || day === 6) {
          return settings.weekendPrice;
      }
      return settings.weekdayPrice;
  };

  const currentPrice = getPricePerHour();
  const totalDuration = selectedTimes.length;
  const totalValue = currentPrice * formData.lanes * totalDuration;

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        const s = await db.settings.get();
        setSettings(s);
        
        // Fetch reservations to calculate availability
        const all = await db.reservations.getAll();
        setExistingReservations(all);

        const storedUser = localStorage.getItem('tonapista_auth');
        if (storedUser) {
            try { setCurrentUser(JSON.parse(storedUser)); } catch (e) {}
        }
        setIsLoading(false);
    };
    fetchData();
  }, []);

  const handleNext = async () => {
    if (currentStep === 2) {
        // --- STEP 2 to 3: SAVE LEAD ---
        setIsSaving(true);
        try {
            // Check if client exists
            let client = await db.clients.getByPhone(formData.whatsapp);
            
            if (!client) {
                // Create new Lead
                await db.clients.create({
                    id: uuidv4(),
                    name: formData.name,
                    phone: formData.whatsapp,
                    email: formData.email,
                    tags: ['Lead'], // Tagging as Lead explicitly
                    createdAt: new Date().toISOString(),
                    lastContactAt: new Date().toISOString(),
                    funnelStage: FunnelStage.NOVO
                });
            } else {
                // Update existing client data
                await db.clients.update({
                    ...client,
                    name: formData.name,
                    email: formData.email,
                    lastContactAt: new Date().toISOString()
                });
            }
            setCurrentStep(c => c + 1);
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar dados do cliente. Tente novamente.");
        } finally {
            setIsSaving(false);
        }
    } else if (currentStep < steps.length - 1) {
        setCurrentStep(c => c + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(c => c - 1);
  };

  // --- Step 1: Calendar Logic ---
  const isDateAllowed = (date: Date) => {
    const day = date.getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Disable past dates
    if (date < today) return false;
    
    // Check if open in settings (0=Sun, 6=Sat)
    const dayConfig = settings.businessHours[day];
    if (!dayConfig || !dayConfig.isOpen) return false;
    
    return true;
  };

  const handleMonthChange = (offset: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setViewDate(newDate);
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    
    const days = [];
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // Header
    const header = (
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map(d => (
          <div key={d} className="text-center text-sm font-bold text-slate-500 py-2">
            {d}
          </div>
        ))}
      </div>
    );

    // Empty slots
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      // Explicit local date construction
      const date = new Date(year, month, d);
      
      const dateStr = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
      ].join('-');

      const allowed = isDateAllowed(date);
      const isSelected = selectedDate === dateStr;

      days.push(
        <button
          key={d}
          disabled={!allowed}
          onClick={() => { setSelectedDate(dateStr); setSelectedTimes([]); }} // Reset times on date change
          className={`
            h-12 rounded-lg flex items-center justify-center font-medium transition-all relative
            ${isSelected 
              ? 'bg-neon-orange text-white shadow-[0_0_10px_rgba(249,115,22,0.5)] z-10 scale-110' 
              : allowed 
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700' 
                : 'bg-slate-900/50 text-slate-600 cursor-not-allowed opacity-50'}
          `}
        >
          {d}
          {allowed && !isSelected && <span className="absolute bottom-1 w-1 h-1 bg-neon-blue rounded-full opacity-50"></span>}
        </button>
      );
    }

    return (
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-lg font-bold text-white capitalize">
            {viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
            <ChevronRight size={20} />
          </button>
        </div>
        {header}
        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>
        <div className="mt-4 flex justify-center items-center gap-4 text-xs text-slate-500">
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-800 border border-slate-700 rounded"></div> Disponível</div>
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-neon-orange rounded"></div> Selecionado</div>
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-900 opacity-50 rounded"></div> Fechado</div>
        </div>
      </div>
    );
  };

  // --- Step 2: Time Logic (MULTI-SELECT) ---
  
  // Calculate availability for a SINGLE hour slot
  const checkHourAvailability = (hourInt: number) => {
    if (!selectedDate) return { available: false, left: 0 };

    const dayReservations = existingReservations.filter(r => 
      r.date === selectedDate && r.status !== ReservationStatus.CANCELADA
    );

    const maxLanes = settings.activeLanes;
    let occupied = 0;

    dayReservations.forEach(r => {
        const rStart = parseInt(r.time.split(':')[0]);
        const rEnd = rStart + r.duration;
        // Check if this specific hour falls within any existing reservation
        if (hourInt >= rStart && hourInt < rEnd) {
            occupied += r.laneCount;
        }
    });

    const left = maxLanes - occupied;
    // Check against desired lanes for the current booking
    const available = left >= formData.lanes;

    return { available, left };
  };

  const generateTimeSlots = () => {
    if (!selectedDate) return [];
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    
    // Get config for specific day
    const dayConfig = settings.businessHours[day];
    if (!dayConfig || !dayConfig.isOpen) return [];

    // Logic to verify if is today
    const now = new Date();
    const todayStr = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('-');
    
    const isToday = selectedDate === todayStr;
    const currentHour = now.getHours();

    let start = dayConfig.start;
    let end = dayConfig.end;
    // Handle closing past midnight (e.g. end=0 means 24)
    if (end === 0) end = 24;
    // If closes next day (e.g. 2am), treat strictly as hours
    if (end < start) end += 24; 

    const slots = [];
    for (let h = start; h < end; h++) {
      // Normalize hour for display (e.g. 25:00 -> 01:00)
      const displayHour = h >= 24 ? h - 24 : h;
      const time = `${displayHour}:00`;
      
      const { available, left } = checkHourAvailability(displayHour);
      
      // If it's today and the slot hour is less than or equal to current hour, it's past
      // Logic adjustment for late night hours if checking 'isToday'
      const isPast = isToday && (h < currentHour || (h === currentHour)); 
      
      slots.push({ 
          time, 
          label: time, 
          available: available && !isPast, 
          left,
          isPast 
      });
    }
    return slots;
  };

  const toggleTimeSelection = (time: string) => {
      setSelectedTimes(prev => {
          if (prev.includes(time)) {
              return prev.filter(t => t !== time);
          } else {
              return [...prev, time].sort((a, b) => parseInt(a) - parseInt(b));
          }
      });
  };

  const handlePeopleChange = (num: number) => {
    const suggestedLanes = Math.ceil(num / 6);
    setFormData(prev => ({ 
        ...prev, 
        people: num, 
        lanes: suggestedLanes,
    }));
  };

  // Helper to Group Contiguous Times for Reservation Creation
  // e.g. ["18:00", "19:00", "22:00"] => [{time: "18:00", duration: 2}, {time: "22:00", duration: 1}]
  const getReservationBlocks = () => {
    if (selectedTimes.length === 0) return [];

    // Fix parsing for past-midnight hours if needed, but for simplicity we sort strictly by value
    const sortedHours = selectedTimes.map(t => parseInt(t.split(':')[0])).sort((a,b) => a - b);
    const blocks: { time: string, duration: number }[] = [];
    
    let currentStart = sortedHours[0];
    let currentDuration = 1;

    for (let i = 1; i < sortedHours.length; i++) {
        // Handle wrap around if necessary, but typically simple linear check
        if (sortedHours[i] === sortedHours[i-1] + 1) {
            currentDuration++;
        } else {
            blocks.push({ time: `${currentStart}:00`, duration: currentDuration });
            currentStart = sortedHours[i];
            currentDuration = 1;
        }
    }
    blocks.push({ time: `${currentStart}:00`, duration: currentDuration });
    return blocks;
  };

  // --- Logic to Confirm Booking ---
  const handleConfirmBooking = async (staffOverride: boolean = false) => {
      setIsSaving(true);
      try {
          const blocks = getReservationBlocks();
          
          // Safety Check: Check availability one last time
          const allRes = await db.reservations.getAll();
          const dayRes = allRes.filter(r => r.date === selectedDate && r.status !== ReservationStatus.CANCELADA);
          const maxLanes = settings.activeLanes;
          
          for (const block of blocks) {
             const startH = parseInt(block.time.split(':')[0]);
             for(let h=0; h<block.duration; h++) {
                 const checkH = startH + h;
                 let occupied = 0;
                 dayRes.forEach(r => {
                     const rStart = parseInt(r.time.split(':')[0]);
                     const rEnd = rStart + r.duration;
                     if(checkH >= rStart && checkH < rEnd) occupied += r.laneCount;
                 });
                 if(occupied + formData.lanes > maxLanes) {
                     alert(`O horário das ${checkH}:00 acabou de ser ocupado. Por favor, revise.`);
                     setIsSaving(false);
                     return;
                 }
             }
          }

          // Fetch Client ID (Should be saved from Step 2)
          let client = await db.clients.getByPhone(formData.whatsapp);
          if (!client) {
             client = await db.clients.create({
                 id: uuidv4(),
                 name: formData.name,
                 phone: formData.whatsapp,
                 email: formData.email,
                 tags: ['Lead'],
                 createdAt: new Date().toISOString(),
                 lastContactAt: new Date().toISOString(),
                 funnelStage: FunnelStage.NOVO
             });
          }

          // Create Reservations as PENDING
          const newIds: string[] = [];
          
          for (const block of blocks) {
             const blockTotalValue = (totalValue / (blocks.reduce((acc, b) => acc + b.duration, 0))) * block.duration;
             
             const res: Reservation = {
                 id: uuidv4(),
                 clientId: client.id,
                 clientName: formData.name,
                 date: selectedDate,
                 time: block.time,
                 peopleCount: formData.people,
                 laneCount: formData.lanes,
                 duration: block.duration,
                 totalValue: blockTotalValue,
                 eventType: formData.type,
                 observations: formData.obs,
                 status: ReservationStatus.PENDENTE,
                 paymentStatus: PaymentStatus.PENDENTE,
                 createdAt: new Date().toISOString(),
                 guests: [],
                 lanes: [],
                 checkedInIds: [],
                 noShowIds: []
             };

             await db.reservations.create(res);
             newIds.push(res.id);
          }

          setCreatedReservationIds(newIds);
          
          // --- LOGIC: DIRECT REDIRECT ---
          if (settings.onlinePaymentEnabled && !staffOverride) {
              const compositeRes = { 
                  id: newIds[0], // Use first ID as ref
                  totalValue: totalValue,
                  clientName: formData.name,
                  clientEmail: formData.email
              } as any;
              
              const checkoutUrl = await Integrations.createMercadoPagoPreference(compositeRes, settings);
              
              if (checkoutUrl) {
                  window.location.href = checkoutUrl;
                  return; 
              } else {
                  // Fallback se MP falhar
                  alert("Houve um erro ao conectar com o banco. Redirecionando para método manual.");
                  navigate('/checkout', { state: { ...formData, date: selectedDate, time: selectedTimes[0], totalValue, reservationBlocks, reservationIds: newIds } });
              }
          } else {
             // Modo offline/legado OU Staff Presencial
             navigate('/checkout', { state: { ...formData, date: selectedDate, time: selectedTimes[0], totalValue, reservationBlocks, reservationIds: newIds } });
          }

      } catch (e) {
          console.error(e);
          alert("Erro ao criar reserva.");
      } finally {
          setIsSaving(false);
      }
  };

  const formattedDateDisplay = selectedDate ? selectedDate.split('-').reverse().join('/') : '';
  const reservationBlocks = getReservationBlocks();
  const showPaymentButton = settings.onlinePaymentEnabled;

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-neon-orange" size={48} /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 p-4 shadow-md border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          {!imgError ? (
             settings.logoUrl ? (
                <img 
                    src={settings.logoUrl}
                    alt={settings.establishmentName}
                    className="h-12 md:h-16 object-contain"
                    onError={() => setImgError(true)}
                />
             ) : (
                <img 
                    src="/logo.png" 
                    alt="Tô Na Pista" 
                    className="h-12 md:h-16 object-contain" 
                    onError={() => setImgError(true)}
                />
             )
           ) : (
             <div className="flex flex-col">
               <h1 className="text-2xl font-bold text-neon-orange font-sans tracking-tighter leading-none">
                 {settings.establishmentName}
               </h1>
             </div>
           )}
          
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-xs font-medium px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
              Agendamento Online
            </div>
            {currentUser ? (
              <Link to="/dashboard" className="flex items-center gap-2 text-neon-blue hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition font-medium text-sm border border-slate-700">
                <LayoutDashboard size={16} />
                <span className="hidden md:inline">Voltar ao Dashboard</span>
              </Link>
            ) : (
              <Link to="/login" className="text-slate-600 hover:text-neon-blue transition p-2 rounded-full hover:bg-slate-800" title="Área da Equipe">
                <Lock size={18} />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          
          {/* Progress Bar (Hide on Success) */}
          {currentStep < 5 && (
            <div className="mb-8">
                <div className="flex justify-between mb-2">
                {steps.map((step, i) => (
                    <div key={i} className={`text-[10px] md:text-sm font-medium ${i <= currentStep ? 'text-neon-blue' : 'text-slate-600'}`}>
                    {step}
                    </div>
                ))}
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-neon-orange to-neon-blue transition-all duration-500 ease-out"
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                ></div>
                </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 md:p-8 shadow-lg min-h-[400px]">
            
            {/* STEP 1: DATE */}
            {currentStep === 0 && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <CalendarIcon className="text-neon-orange" /> Escolha a Data
                </h2>
                
                {renderCalendar()}

                <div className="mt-8 flex justify-between items-center">
                   <div className="text-slate-400">
                     {selectedDate 
                       ? `Data escolhida: ${formattedDateDisplay}` 
                       : 'Selecione uma data no calendário'}
                   </div>
                   <button 
                    disabled={!selectedDate}
                    onClick={handleNext}
                    className="px-8 py-3 bg-neon-blue text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-400 transition shadow-lg shadow-blue-500/20"
                   >
                     Próximo
                   </button>
                </div>
              </div>
            )}

            {/* STEP 2: TIME & CONFIGURATION */}
            {currentStep === 1 && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Clock className="text-neon-orange" /> Configuração e Horário
                </h2>
                
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mb-6">
                    <h3 className="text-sm font-bold text-slate-300 uppercase mb-3">Detalhes do Evento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Nº Pessoas</label>
                            <input 
                            type="number"
                            min={1}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white"
                            value={formData.people}
                            onChange={e => handlePeopleChange(parseInt(e.target.value) || 1)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Nº Pistas</label>
                            <input 
                            type="number"
                            min={1}
                            max={settings.activeLanes}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white font-bold"
                            value={formData.lanes}
                            onChange={e => {
                                // If current selected times are no longer valid with new lane count, clear them
                                const count = parseInt(e.target.value) || 1;
                                setFormData(prev => ({...prev, lanes: count}));
                                setSelectedTimes([]); // Safety reset
                            }}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Total Horas</label>
                            <div className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-2 text-white font-bold flex items-center justify-between">
                                <span>{totalDuration}h</span>
                                <span className="text-[10px] text-slate-400 font-normal">Selecionadas</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                            <select 
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white"
                            value={formData.type}
                            onChange={e => setFormData({...formData, type: e.target.value as EventType})}
                            >
                            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    {/* Price Indicator */}
                    <div className="mt-3 pt-3 border-t border-slate-700 flex justify-end">
                        <span className="text-sm text-slate-400">
                            Valor por hora/pista: <strong className="text-neon-green">{currentPrice.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</strong>
                        </span>
                    </div>
                </div>

                <p className="text-slate-400 mb-4">
                    Selecione os horários desejados. <br/>
                    <span className="text-xs italic opacity-70">Você pode selecionar horários alternados (ex: 18:00 e 22:00).</span>
                </p>

                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {generateTimeSlots().length === 0 ? (
                      <div className="col-span-3 md:col-span-5 text-center text-slate-500 py-4 italic">
                          Fechado nesta data.
                      </div>
                  ) : (
                    generateTimeSlots().map(({ time, label, available, left, isPast }) => {
                        const isSelected = selectedTimes.includes(time);
                        return (
                            <button
                            key={time}
                            disabled={!available && !isSelected}
                            onClick={() => toggleTimeSelection(time)}
                            className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center relative overflow-hidden ${
                                isSelected
                                ? 'bg-neon-blue text-white border-neon-blue shadow-[0_0_15px_rgba(59,130,246,0.5)] transform scale-105 z-10'
                                : !available
                                    ? 'border-slate-800 bg-slate-900/50 text-slate-600 cursor-not-allowed opacity-60'
                                    : 'border-slate-700 bg-slate-800 hover:border-slate-500 text-slate-300 hover:bg-slate-700'
                            }`}
                            >
                            <div className="text-sm md:text-base font-bold">{label}</div>
                            {!available && !isSelected ? (
                                <span className="text-[9px] uppercase mt-1 text-red-500/70 font-bold">
                                    {isPast ? 'Encerrado' : 'Esgotado'}
                                </span>
                            ) : (
                                <div className="flex flex-col items-center">
                                    {isSelected ? (
                                        <span className="text-[10px] mt-1 text-white font-bold">Selecionado</span>
                                    ) : (
                                        <span className="text-[9px] text-slate-500 mt-1">Restam {left}</span>
                                    )}
                                </div>
                            )}
                            </button>
                        );
                    })
                  )}
                </div>
                 <div className="mt-8 flex justify-between">
                   <button onClick={handleBack} className="text-slate-400 hover:text-white font-medium">Voltar</button>
                   <button 
                    disabled={selectedTimes.length === 0}
                    onClick={handleNext}
                    className="px-8 py-3 bg-neon-blue text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-400 transition"
                   >
                     Próximo
                   </button>
                </div>
              </div>
            )}

            {/* STEP 3: DETAILS */}
            {currentStep === 2 && (
              <div className="animate-fade-in space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Users className="text-neon-orange" /> Seus Dados
                </h2>
                
                {/* Main Contact */}
                <div>
                    <h3 className="text-sm font-bold text-slate-300 uppercase mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-neon-blue text-white flex items-center justify-center text-xs">1</span> 
                        Responsável Principal (Obrigatório)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Nome Completo</label>
                            <div className="relative">
                                <UserIcon size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input 
                                type="text"
                                placeholder="Nome e Sobrenome"
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 pl-10 focus:border-neon-orange focus:outline-none text-white"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">WhatsApp</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input 
                                type="tel"
                                placeholder="(00) 00000-0000"
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 pl-10 focus:border-neon-orange focus:outline-none text-white"
                                value={formData.whatsapp}
                                onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2 lg:col-span-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">E-mail</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input 
                                type="email"
                                placeholder="seu@email.com"
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 pl-10 focus:border-neon-orange focus:outline-none text-white"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Second Responsible Toggle */}
                <div className="pt-4 border-t border-slate-800">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-6 h-6 rounded border flex items-center justify-center transition ${formData.hasSecondResponsible ? 'bg-neon-blue border-neon-blue' : 'border-slate-600 group-hover:border-slate-400'}`}>
                            {formData.hasSecondResponsible && <CheckCircle size={16} className="text-white" />}
                        </div>
                        <input 
                            type="checkbox" 
                            className="hidden"
                            checked={formData.hasSecondResponsible}
                            onChange={e => setFormData({...formData, hasSecondResponsible: e.target.checked})}
                        />
                        <span className="font-bold text-slate-300 group-hover:text-white transition">Adicionar Segundo Responsável? <span className="text-xs font-normal text-slate-500">(Opcional)</span></span>
                    </label>

                    {formData.hasSecondResponsible && (
                        <div className="mt-4 animate-fade-in p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                             <h3 className="text-sm font-bold text-slate-300 uppercase mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs">2</span> 
                                Segundo Responsável
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Nome Completo</label>
                                    <input 
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 focus:border-neon-orange focus:outline-none text-white"
                                    value={formData.secondName}
                                    onChange={e => setFormData({...formData, secondName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">WhatsApp</label>
                                    <input 
                                    type="tel"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 focus:border-neon-orange focus:outline-none text-white"
                                    value={formData.secondWhatsapp}
                                    onChange={e => setFormData({...formData, secondWhatsapp: e.target.value})}
                                    />
                                </div>
                                <div className="md:col-span-2 lg:col-span-1">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">E-mail (Opcional)</label>
                                    <input 
                                    type="email"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 focus:border-neon-orange focus:outline-none text-white"
                                    value={formData.secondEmail}
                                    onChange={e => setFormData({...formData, secondEmail: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Observações</label>
                    <textarea 
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 focus:border-neon-orange focus:outline-none h-20 text-white"
                      value={formData.obs}
                      onChange={e => setFormData({...formData, obs: e.target.value})}
                    />
                </div>

                 <div className="mt-8 flex justify-between items-center">
                   <button onClick={handleBack} className="text-slate-400 hover:text-white font-medium">Voltar</button>
                   <div className="flex flex-col items-end gap-2">
                     <button 
                      disabled={!formData.name || !formData.whatsapp || !formData.email || isSaving}
                      onClick={handleNext}
                      className="px-8 py-3 bg-neon-blue text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-400 transition flex items-center gap-2"
                     >
                       {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Próximo'}
                     </button>
                   </div>
                </div>
              </div>
            )}

            {/* STEP 4: SUMMARY */}
            {currentStep === 3 && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <CheckCircle className="text-neon-green" /> Resumo da Reserva
                </h2>

                <div className="bg-slate-800/50 rounded-xl p-6 space-y-4 border border-slate-700">
                  <div className="flex justify-between border-b border-slate-700 pb-2">
                     <span className="text-slate-400">Responsável Principal</span>
                     <div className="text-right">
                         <span className="font-bold text-white block">{formData.name}</span>
                         <span className="text-xs text-slate-500 block">{formData.whatsapp} | {formData.email}</span>
                     </div>
                  </div>
                  
                  <div className="flex justify-between border-b border-slate-700 pb-2">
                     <span className="text-slate-400">Data</span>
                     <span className="font-bold text-white">{formattedDateDisplay}</span>
                  </div>
                  
                  {/* Reservation Blocks Summary */}
                  <div className="border-b border-slate-700 pb-2">
                      <span className="text-slate-400 block mb-2">Horários Selecionados</span>
                      <div className="space-y-2">
                        {reservationBlocks.map((block, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-900/50 p-2 rounded">
                                <span className="font-bold text-white">{block.time}</span>
                                <span className="text-xs text-slate-400">{block.duration} hora(s) de duração</span>
                            </div>
                        ))}
                      </div>
                  </div>

                   <div className="flex justify-between border-b border-slate-700 pb-2">
                     <span className="text-slate-400">Detalhes Gerais</span>
                     <span className="font-bold text-white">{formData.people} pessoas / {formData.lanes} pista(s) / {totalDuration}h total</span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                     <span className="text-slate-400 flex items-center gap-1"><DollarSign size={16}/> Valor Total</span>
                     <span className="font-bold text-2xl text-neon-green">
                        {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                     </span>
                  </div>
                </div>

                 <div className="mt-8 flex justify-between items-center">
                   <button onClick={handleBack} className="text-slate-400 hover:text-white font-medium">Voltar e Editar</button>
                   
                   <button 
                      onClick={() => setCurrentStep(4)}
                      className="px-8 py-3 bg-neon-blue text-white font-bold rounded-lg hover:bg-blue-500 transition flex items-center gap-2"
                   >
                      Avançar <ChevronRight size={18}/>
                   </button>
                </div>
              </div>
            )}
            
            {/* STEP 5: PRE-BOOKING & PAYMENT (NOVO PASSO) */}
            {currentStep === 4 && (
                <div className="animate-fade-in text-center pt-8">
                     <div className="w-20 h-20 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                        <Lock size={40} className="text-neon-blue" />
                     </div>
                     <h2 className="text-3xl font-bold text-white mb-4">Garantia de Reserva</h2>
                     <p className="text-slate-300 max-w-lg mx-auto mb-8 text-lg">
                        Seu pré-agendamento foi gerado! <br/>
                        <span className="text-neon-orange font-bold">Atenção:</span> Para garantir a reserva da pista, é necessário efetuar o pagamento antecipado.
                     </p>

                     <div className="bg-slate-800 p-4 rounded-lg max-w-md mx-auto mb-8 border border-slate-700">
                        <p className="text-sm text-slate-400 mb-1">Valor Total a Pagar</p>
                        <p className="text-3xl font-bold text-neon-green">
                            {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                     </div>

                     <div className="flex flex-col gap-4 max-w-sm mx-auto">
                        {/* Botão Principal - Mercado Pago */}
                         <button 
                            disabled={isSaving}
                            onClick={() => handleConfirmBooking(false)}
                            className={`w-full py-4 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 transition transform hover:-translate-y-1 bg-gradient-to-r from-neon-green to-emerald-600 hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]`}
                        >
                            {isSaving ? (
                                <><Loader2 className="animate-spin" /> Processando...</>
                            ) : (
                                <><ShieldCheck size={24}/> Garantir Reserva e Pagar</>
                            )}
                        </button>
                        
                        <p className="text-xs text-slate-500 mt-1">
                            Você será redirecionado para o ambiente seguro do Mercado Pago.
                        </p>

                        {/* Botão Staff - Aparece se logado */}
                        {currentUser && (
                             <button 
                                disabled={isSaving}
                                onClick={() => handleConfirmBooking(true)}
                                className="mt-4 w-full py-3 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-lg hover:bg-slate-700 hover:text-white transition flex items-center justify-center gap-2"
                             >
                                <CreditCard size={18}/> Pagar no Local (Equipe)
                             </button>
                        )}

                        <button onClick={handleBack} className="mt-4 text-slate-500 hover:text-white text-sm">Voltar</button>
                     </div>
                </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicBooking;
