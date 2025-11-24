import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, PaymentStatus } from '../types';
import { Loader2, DollarSign, TrendingUp, Users, Calendar, Filter, AlertCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Financeiro: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Initialize date range to current month (Local Time)
  useEffect(() => {
    const now = new Date();
    const toLocalISO = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    setDateRange({ 
        start: toLocalISO(firstDay), 
        end: toLocalISO(lastDay) 
    });
  }, []);

  const refreshData = async () => {
    setLoading(true);
    const all = await db.reservations.getAll();
    setReservations(all);
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Filters
  const filtered = reservations.filter(r => {
    if (r.status === ReservationStatus.CANCELADA) return false;
    if (r.date < dateRange.start || r.date > dateRange.end) return false;
    return true;
  });

  // Total Revenue: Only count CONFIRMED, CHECK_IN or PAID (Exclude PENDING)
  const totalRevenue = filtered
    .filter(r => r.status !== ReservationStatus.PENDENTE)
    .reduce((acc, curr) => acc + curr.totalValue, 0);
  
  // Pending Revenue (Where status is Pending)
  const pendingRevenue = filtered
    .filter(r => r.status === ReservationStatus.PENDENTE)
    .reduce((acc, curr) => acc + curr.totalValue, 0);

  // Confirmed Slots Calculation (Hours * Lanes) for Confirmed/Paid/Check-in
  // This represents "Total Horas Vendidas" (Total Pistas x Horas)
  const confirmedSlots = filtered
    .filter(r => r.status !== ReservationStatus.PENDENTE && r.status !== ReservationStatus.NO_SHOW)
    .reduce((acc, curr) => acc + (curr.duration * curr.laneCount), 0);

  // Ticket Médio: Faturamento / Numero de Horas Vendidas
  const avgTicket = confirmedSlots > 0 ? totalRevenue / confirmedSlots : 0;
  
  // Charts Data
  // 1. Revenue by Day (Only confirmed money)
  const revenueByDayMap = new Map<string, number>();
  filtered
    .filter(r => r.status !== ReservationStatus.PENDENTE)
    .forEach(r => {
        const val = revenueByDayMap.get(r.date) || 0;
        revenueByDayMap.set(r.date, val + r.totalValue);
  });
  const revenueChartData = Array.from(revenueByDayMap.entries())
    .map(([date, value]) => ({ date: date.split('-').slice(1).reverse().join('/'), value }))
    .sort((a,b) => a.date.localeCompare(b.date));

  // 2. Top Clients
  // Calculation: Quantidade de reservas feitas relacionando a quantidade de pista x quantidade de horas
  const clientSpendMap = new Map<string, {name: string, total: number, slots: number}>();
  filtered.forEach(r => {
      // For Top Clients, we usually want to see potential too, but for strict financial ranking, maybe only confirmed?
      // Keeping all non-cancelled to see 'Best Customers' even if they haven't paid perfectly yet (CRM view),
      // OR restrict to revenue. Let's keep logic consistent with Total Revenue for the "Total" column.
      
      const current = clientSpendMap.get(r.clientId) || { name: r.clientName, total: 0, slots: 0 };
      
      // Accumulate Total only if not pending (Revenue)
      if (r.status !== ReservationStatus.PENDENTE) {
        current.total += r.totalValue;
      }
      
      // Accumulate Pista x Horas (Usage volume)
      current.slots += (r.duration * r.laneCount);
      clientSpendMap.set(r.clientId, current);
  });
  
  const topClients = Array.from(clientSpendMap.values())
    .sort((a,b) => b.total - a.total)
    .slice(0, 5);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>;

  return (
    <div className="space-y-8 animate-fade-in pb-20 md:pb-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Financeiro</h1>
                <p className="text-slate-400">Resultados e performance de vendas</p>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 w-full md:w-auto overflow-x-auto">
                <Filter size={18} className="text-slate-400 ml-2 flex-shrink-0" />
                <input 
                    type="date" 
                    className="bg-transparent text-white text-sm focus:outline-none border-r border-slate-700 pr-2"
                    value={dateRange.start}
                    onChange={e => setDateRange({...dateRange, start: e.target.value})}
                />
                <span className="text-slate-500 flex-shrink-0">até</span>
                <input 
                    type="date" 
                    className="bg-transparent text-white text-sm focus:outline-none pl-2"
                    value={dateRange.end}
                    onChange={e => setDateRange({...dateRange, end: e.target.value})}
                />
            </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-6">
            
            {/* Faturamento */}
            <div className="bg-slate-800 p-3 lg:p-6 rounded-xl border border-green-500/30 flex items-center justify-between shadow-sm lg:shadow-lg hover:border-green-500 transition">
                <div className="flex flex-row lg:flex-col lg:items-start items-center gap-3 lg:gap-0">
                    <div className="lg:hidden p-1.5 sm:p-2 bg-green-500/10 rounded-lg text-green-500">
                        <DollarSign size={18} />
                    </div>
                    <div>
                         <span className="text-[10px] sm:text-xs lg:text-sm text-green-500 lg:text-slate-400 uppercase font-bold lg:tracking-wide">Faturamento</span>
                         <p className="hidden lg:block text-2xl xl:text-3xl font-bold text-green-500 mt-2">
                            {totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                         </p>
                    </div>
                </div>
                <div>
                    <span className="lg:hidden text-lg sm:text-2xl font-bold text-green-500">
                        {totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <div className="hidden lg:block p-4 bg-green-500/10 rounded-full text-green-500 border border-green-500/20">
                        <DollarSign size={28} />
                    </div>
                </div>
            </div>

            {/* Valor Pendente */}
            <div className="bg-slate-800 p-3 lg:p-6 rounded-xl border border-yellow-500/30 flex items-center justify-between shadow-sm lg:shadow-lg hover:border-yellow-500 transition">
                <div className="flex flex-row lg:flex-col lg:items-start items-center gap-3 lg:gap-0">
                    <div className="lg:hidden p-1.5 sm:p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                        <AlertCircle size={18} />
                    </div>
                    <div>
                        <span className="text-[10px] sm:text-xs lg:text-sm text-yellow-500 lg:text-slate-400 uppercase font-bold lg:tracking-wide">Pendente</span>
                        <p className="hidden lg:block text-2xl xl:text-3xl font-bold text-yellow-500 mt-2">
                            {pendingRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                </div>
                <div>
                    <span className="lg:hidden text-lg sm:text-2xl font-bold text-yellow-500">
                        {pendingRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <div className="hidden lg:block p-4 bg-yellow-500/10 rounded-full text-yellow-500 border border-yellow-500/20">
                        <AlertCircle size={28} />
                    </div>
                </div>
            </div>

            {/* Reservas (Slots) */}
            <div className="bg-slate-800 p-3 lg:p-6 rounded-xl border border-slate-700 flex items-center justify-between shadow-sm lg:shadow-lg hover:border-slate-500 transition">
                <div className="flex flex-row lg:flex-col lg:items-start items-center gap-3 lg:gap-0">
                    <div className="lg:hidden p-1.5 sm:p-2 bg-slate-700/50 rounded-lg text-slate-400">
                        <Clock size={18} />
                    </div>
                    <div>
                        <span className="text-[10px] sm:text-xs lg:text-sm text-slate-400 lg:text-slate-400 uppercase font-bold lg:tracking-wide">Total De Reservas</span>
                        <p className="hidden lg:block text-2xl xl:text-3xl font-bold text-white mt-2">
                             {confirmedSlots}
                        </p>
                    </div>
                </div>
                <div>
                     <span className="lg:hidden text-lg sm:text-2xl font-bold text-white">{confirmedSlots}</span>
                     <div className="hidden lg:block p-4 bg-slate-700/30 rounded-full text-slate-200 border border-slate-600">
                        <Clock size={28} />
                    </div>
                </div>
            </div>

            {/* Ticket Médio */}
            <div className="bg-slate-800 p-3 lg:p-6 rounded-xl border border-neon-orange/30 flex items-center justify-between shadow-sm lg:shadow-lg hover:border-neon-orange transition">
                <div className="flex flex-row lg:flex-col lg:items-start items-center gap-3 lg:gap-0">
                    <div className="lg:hidden p-1.5 sm:p-2 bg-neon-orange/10 rounded-lg text-neon-orange">
                        <TrendingUp size={18} />
                    </div>
                    <div>
                        <span className="text-[10px] sm:text-xs lg:text-sm text-neon-orange lg:text-slate-400 uppercase font-bold lg:tracking-wide">Ticket Médio</span>
                         <p className="hidden lg:block text-2xl xl:text-3xl font-bold text-neon-orange mt-2">
                             {avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                         </p>
                    </div>
                </div>
                <div>
                    <span className="lg:hidden text-lg sm:text-2xl font-bold text-neon-orange">
                        {avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <div className="hidden lg:block p-4 bg-neon-orange/10 rounded-full text-neon-orange border border-neon-orange/20">
                        <TrendingUp size={28} />
                    </div>
                </div>
            </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Chart */}
            <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-6">Faturamento Diário (Realizado)</h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="date" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip 
                                contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff'}}
                                itemStyle={{color: '#22c55e'}}
                            />
                            <Bar dataKey="value" name="Valor (R$)" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Clients Table */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col">
                <h3 className="text-lg font-bold text-white mb-4">Top 5 Clientes (Reservas)</h3>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-slate-400 border-b border-slate-700">
                            <tr>
                                <th className="pb-2">Cliente</th>
                                <th className="pb-2 text-right">Reservas</th>
                                <th className="pb-2 text-right">Pago</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {topClients.map((c, i) => (
                                <tr key={i} className="group hover:bg-slate-700/50">
                                    <td className="py-3 font-medium text-white">{c.name}</td>
                                    <td className="py-3 text-right text-slate-400">{c.slots}</td>
                                    <td className="py-3 text-right text-neon-green font-bold">
                                        {c.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                </tr>
                            ))}
                            {topClients.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-slate-500">Sem dados no período</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Financeiro;