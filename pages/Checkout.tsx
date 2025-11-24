
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Integrations } from '../services/integrations';
import { Reservation, ReservationStatus, FunnelStage, User, PaymentStatus } from '../types';
import { CheckCircle, CreditCard, Smartphone, Loader2, ShieldCheck, Wallet, Store, ExternalLink, AlertTriangle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

type PaymentMethod = 'ONLINE' | 'IN_PERSON';

const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Se integração ativa, o método padrão é ONLINE (Redirecionamento), senão mostra abas manuais (PIX/Cartão Fake)
  const [paymentTab, setPaymentTab] = useState<'PIX' | 'CREDIT' | 'ONLINE' | 'IN_PERSON'>('PIX');
  
  const [imgError, setImgError] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inPersonType, setInPersonType] = useState<'DINHEIRO' | 'CARTAO' | 'PIX'>('DINHEIRO');
  const [settings, setSettings] = useState<any>(null);

  // Reservation data passed from PublicBooking
  const reservationData = location.state as any;

  useEffect(() => {
    if (!reservationData) {
      navigate('/agendamento');
      return;
    }
    const storedUser = localStorage.getItem('tonapista_auth');
    if (storedUser) {
        try { setCurrentUser(JSON.parse(storedUser)); } catch(e) {}
    }
    
    db.settings.get().then(s => {
        setSettings(s);
        // Se integração estiver ativa e não for staff, padrão é ONLINE
        if (s.onlinePaymentEnabled && !storedUser) {
            setPaymentTab('ONLINE');
        }
    });
  }, [reservationData, navigate]);

  if (!reservationData) return null;

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
        // 0. Update Client
        let client = await db.clients.getByPhone(reservationData.whatsapp);
        
        if (!client) {
          client = await db.clients.create({
              id: uuidv4(),
              name: reservationData.name,
              phone: reservationData.whatsapp,
              email: reservationData.email,
              tags: ['Lead novo'],
              createdAt: new Date().toISOString(),
              lastContactAt: new Date().toISOString()
          });
        } else {
            if (!client.tags.includes('Cliente recorrente') && client.tags.includes('Lead novo')) {
               client.tags.push('Cliente recorrente');
            }
            await db.clients.update(client);
        }

        // 2. Determine status based on payment
        const isStaffAction = paymentTab === 'IN_PERSON' && !!currentUser;
        
        let finalStatus = ReservationStatus.PENDENTE;
        let paymentStatus = PaymentStatus.PENDENTE;

        if (isStaffAction) {
            finalStatus = ReservationStatus.CONFIRMADA;
            paymentStatus = PaymentStatus.PAGO;
        }

        const notes = isStaffAction 
            ? `${reservationData.obs || ''} [Pgto Presencial: ${inPersonType}]` 
            : reservationData.obs;

        // 3. Handle Reservation Updates/Creation
        const existingIds = reservationData.reservationIds;
        let firstReservationId = '';

        if (existingIds && existingIds.length > 0) {
            const allRes = await db.reservations.getAll();
            for (const id of existingIds) {
                 const existingRes = allRes.find(r => r.id === id);
                 if (existingRes) {
                     const updatedRes = {
                         ...existingRes,
                         status: finalStatus,
                         paymentStatus: paymentStatus,
                         observations: notes
                     };
                     await db.reservations.update(updatedRes);
                     if (!firstReservationId) firstReservationId = id;
                 }
            }
        } else {
            const blocks = reservationData.reservationBlocks || [{ time: reservationData.time, duration: reservationData.duration }];
            for (const block of blocks) {
                 const blockTotalValue = (reservationData.totalValue / (reservationData.reservationBlocks?.reduce((acc:number, b:any) => acc + b.duration, 0) || reservationData.duration)) * block.duration;

                 const newRes: Reservation = {
                    id: uuidv4(),
                    clientId: client.id,
                    clientName: reservationData.name,
                    date: reservationData.date,
                    time: block.time,
                    peopleCount: reservationData.people,
                    laneCount: reservationData.lanes,
                    duration: block.duration,
                    totalValue: blockTotalValue,
                    eventType: reservationData.type,
                    observations: notes,
                    status: finalStatus,
                    paymentStatus: paymentStatus, 
                    createdAt: new Date().toISOString(),
                    guests: reservationData.guests || []
                 };
                 
                 await db.reservations.create(newRes);
                 if(!firstReservationId) firstReservationId = newRes.id;
            }
        }

        // 4. Update Funnel
        const stage = isStaffAction ? FunnelStage.AGENDADO : FunnelStage.NEGOCIACAO;
        await db.clients.updateStage(client.id, stage);

        // 5. Payment Integration (Redirect if ONLINE)
        // Se for staff pagando presencial, finaliza.
        // Se for onlinePayment e o usuario estiver na aba ONLINE, redireciona.
        if (!isStaffAction && settings?.onlinePaymentEnabled && paymentTab === 'ONLINE') {
             const compositeRes = { 
                 id: firstReservationId, 
                 totalValue: reservationData.totalValue,
                 clientName: reservationData.name,
                 clientEmail: reservationData.email
             } as any;
             
             // Chama a integração real
             const checkoutUrl = await Integrations.createMercadoPagoPreference(compositeRes, settings);
             if (checkoutUrl) {
                 window.location.href = checkoutUrl;
                 return; 
             } else {
                 alert("Erro ao gerar link de pagamento. Verifique as credenciais nas configurações.");
                 setIsProcessing(false);
                 return;
             }
        }

        setIsSuccess(true);
    } catch (e) {
        console.error(e);
        alert('Erro ao processar reserva.');
    } finally {
        setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-center p-6">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-neon-green animate-scale-in">
          <div className="mx-auto w-20 h-20 bg-neon-green/20 text-neon-green rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Reserva Salva!</h2>
          <p className="text-slate-300 mb-6">
            A reserva foi registrada com sucesso.
          </p>
          <div className="bg-slate-900 p-4 rounded-lg text-left mb-6 text-sm text-slate-400 border border-slate-700">
            <p className="flex justify-between"><strong className="text-slate-200">Data:</strong> <span>{new Date(reservationData.date).toLocaleDateString('pt-BR')}</span></p>
            <p className="flex justify-between mt-2"><strong className="text-slate-200">Valor Total:</strong> <span className="text-neon-green font-bold">{reservationData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
          </div>
          <div className="space-y-3">
             <Link 
                to="/agendamento" 
                className="block w-full py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition font-medium"
            >
                Novo Agendamento
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Verifica se a integração está ativa para decidir qual interface mostrar
  const integrationActive = settings?.onlinePaymentEnabled && settings?.mercadopagoAccessToken;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      <header className="bg-slate-900 p-4 shadow-md border-b border-slate-800">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
           {!imgError ? (
             <img 
               src="/logo.png" 
               alt="Tô Na Pista" 
               className="h-12 md:h-16 object-contain" 
               onError={() => setImgError(true)}
             />
           ) : (
             <div className="flex flex-col">
               <h1 className="text-2xl font-bold text-neon-orange font-sans tracking-tighter leading-none">TÔ NA PISTA</h1>
             </div>
           )}
          <div className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <ShieldCheck size={16} className="text-neon-green" /> Ambiente Seguro
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-1 order-2 md:order-1">
             <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 sticky top-24">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2">Resumo do Pedido</h3>
                <div className="space-y-3 text-sm text-slate-300">
                   <p className="flex justify-between">
                     <span>Pistas ({reservationData.lanes})</span>
                     <span>{reservationData.lanes} x R$ {reservationData.lanes > 0 ? (reservationData.totalValue / (reservationData.duration * reservationData.lanes)).toFixed(2) : 0}</span>
                   </p>
                   {reservationData.reservationBlocks ? (
                        reservationData.reservationBlocks.map((b:any, i:number) => (
                            <p key={i} className="flex justify-between border-t border-slate-800 pt-1 mt-1">
                                <span>{b.time} ({b.duration}h)</span>
                                <span>x {b.duration}</span>
                            </p>
                        ))
                   ) : (
                       <p className="flex justify-between">
                        <span>Horas ({reservationData.duration}h)</span>
                        <span>x {reservationData.duration}</span>
                        </p>
                   )}
                   
                   <div className="border-t border-slate-800 pt-3 mt-3 flex justify-between items-center">
                      <span className="font-bold text-white">Total a Pagar</span>
                      <span className="font-bold text-xl text-neon-green">
                        {reservationData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                   </div>
                </div>
             </div>
          </div>

          <div className="md:col-span-2 order-1 md:order-2">
            <h2 className="text-2xl font-bold text-white mb-6">Pagamento</h2>
            
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
               <div className="flex border-b border-slate-800 overflow-x-auto">
                  
                  {/* Se integração ativa, mostra apenas a aba Online Geral (que inclui Pix e Cartão no Mercado Pago) */}
                  {integrationActive ? (
                      <button 
                        onClick={() => setPaymentTab('ONLINE')}
                        className={`flex-1 py-4 flex flex-col items-center gap-1 transition min-w-[100px] ${paymentTab === 'ONLINE' ? 'bg-slate-800 text-neon-blue border-b-2 border-neon-blue' : 'text-slate-400 hover:bg-slate-800'}`}
                    >
                        <ShieldCheck size={24} />
                        <span className="text-sm font-medium">Pagamento Online</span>
                    </button>
                  ) : (
                      // Se integração inativa, mostra abas manuais (Simulação)
                      <>
                        <button 
                            onClick={() => setPaymentTab('PIX')}
                            className={`flex-1 py-4 flex flex-col items-center gap-1 transition min-w-[100px] ${paymentTab === 'PIX' ? 'bg-slate-800 text-neon-blue border-b-2 border-neon-blue' : 'text-slate-400 hover:bg-slate-800'}`}
                        >
                            <Smartphone size={24} />
                            <span className="text-sm font-medium">PIX Manual</span>
                        </button>
                        <button 
                            onClick={() => setPaymentTab('CREDIT')}
                            className={`flex-1 py-4 flex flex-col items-center gap-1 transition min-w-[100px] ${paymentTab === 'CREDIT' ? 'bg-slate-800 text-neon-blue border-b-2 border-neon-blue' : 'text-slate-400 hover:bg-slate-800'}`}
                        >
                            <CreditCard size={24} />
                            <span className="text-sm font-medium">Cartão</span>
                        </button>
                      </>
                  )}

                  {currentUser && (
                    <button 
                        onClick={() => setPaymentTab('IN_PERSON')}
                        className={`flex-1 py-4 flex flex-col items-center gap-1 transition min-w-[120px] bg-slate-800/50 ${paymentTab === 'IN_PERSON' ? 'text-neon-orange border-b-2 border-neon-orange' : 'text-slate-500 hover:text-white'}`}
                    >
                        <Store size={24} />
                        <span className="text-sm font-bold">Presencial</span>
                    </button>
                  )}
               </div>

               <div className="p-8">
                  
                  {/* CONTEUDO: PAGAMENTO ONLINE REAL */}
                  {paymentTab === 'ONLINE' && integrationActive && (
                      <div className="text-center animate-fade-in py-6">
                          <div className="mb-6 flex justify-center">
                              <img src="https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/5.19.5/mercadopago/logo__large.png" alt="Mercado Pago" className="h-10 opacity-90" />
                          </div>
                          
                          <h3 className="text-xl font-bold text-white mb-2">Finalize seu pagamento com segurança</h3>
                          <p className="text-slate-400 mb-8 max-w-md mx-auto">
                              Ao clicar em "Pagar", você será redirecionado para o Mercado Pago onde poderá escolher pagar via <strong>PIX</strong> (QR Code Dinâmico) ou <strong>Cartão de Crédito</strong>.
                          </p>

                          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex items-center gap-3 text-left max-w-sm mx-auto mb-6">
                              <ShieldCheck className="text-green-500 flex-shrink-0" size={24} />
                              <div>
                                  <p className="text-sm font-bold text-white">Ambiente Protegido</p>
                                  <p className="text-xs text-slate-400">Seus dados são processados diretamente pelo Mercado Pago.</p>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* CONTEUDO: PIX MANUAL (LEGADO/SEM INTEGRAÇÃO) */}
                  {paymentTab === 'PIX' && !integrationActive && (
                    <div className="text-center animate-fade-in">
                       <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded mb-4 text-xs text-yellow-500 flex items-center justify-center gap-2">
                           <AlertTriangle size={14}/> Modo Manual (Integração Desativada)
                       </div>
                       <p className="text-slate-300 mb-6">Escaneie o QR Code abaixo para pagar:</p>
                       <div className="bg-white p-4 rounded-lg inline-block mb-6">
                         <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=SimulacaoPagamentoToNaPista" alt="QR Code PIX" className="w-48 h-48" />
                       </div>
                       <div className="max-w-xs mx-auto bg-slate-800 p-3 rounded border border-slate-700 flex items-center justify-between">
                          <code className="text-xs text-slate-400 truncate mr-2">00020126580014br.gov.bcb.pix0136...</code>
                          <button className="text-neon-blue text-xs font-bold hover:underline">Copiar</button>
                       </div>
                    </div>
                  )}

                  {/* CONTEUDO: CARTÃO MANUAL (LEGADO/SEM INTEGRAÇÃO) */}
                  {paymentTab === 'CREDIT' && !integrationActive && (
                    <div className="space-y-4 animate-fade-in max-w-md mx-auto">
                       <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded mb-4 text-xs text-yellow-500 flex items-center justify-center gap-2">
                           <AlertTriangle size={14}/> Simulação Visual (Integração Desativada)
                       </div>
                       <div>
                         <label className="block text-xs text-slate-400 mb-1 uppercase font-bold">Número do Cartão</label>
                         <div className="relative">
                           <CreditCard className="absolute left-3 top-3 text-slate-500" size={18} />
                           <input type="text" placeholder="0000 0000 0000 0000" className="w-full bg-slate-800 border border-slate-600 rounded-lg py-3 pl-10 pr-4 text-white focus:border-neon-blue focus:outline-none" />
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-bold">Validade</label>
                            <input type="text" placeholder="MM/AA" className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-bold">CVV</label>
                            <input type="text" placeholder="123" className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none" />
                          </div>
                       </div>
                       <div>
                         <label className="block text-xs text-slate-400 mb-1 uppercase font-bold">Nome no Cartão</label>
                         <input type="text" placeholder="COMO NO CARTÃO" className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none" />
                       </div>
                    </div>
                  )}

                  {/* CONTEUDO: PRESENCIAL */}
                  {paymentTab === 'IN_PERSON' && currentUser && (
                      <div className="animate-fade-in space-y-6">
                          <div className="bg-neon-orange/10 border border-neon-orange/30 p-4 rounded-lg flex items-center gap-3">
                              <div className="bg-neon-orange text-white p-2 rounded-full"><Store size={20}/></div>
                              <div>
                                  <h4 className="font-bold text-white">Pagamento no Balcão</h4>
                                  <p className="text-xs text-slate-400">Registre o recebimento realizado na recepção.</p>
                              </div>
                          </div>
                          
                          <div>
                              <label className="block text-sm font-bold text-slate-300 mb-3">Forma de Pagamento:</label>
                              <div className="grid grid-cols-3 gap-3">
                                  <label className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center gap-2 transition ${inPersonType === 'DINHEIRO' ? 'bg-slate-700 border-neon-green text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                      <input type="radio" name="payType" value="DINHEIRO" className="hidden" checked={inPersonType === 'DINHEIRO'} onChange={() => setInPersonType('DINHEIRO')}/>
                                      <Wallet />
                                      <span className="text-sm font-medium">Dinheiro</span>
                                  </label>
                                  <label className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center gap-2 transition ${inPersonType === 'CARTAO' ? 'bg-slate-700 border-neon-blue text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                      <input type="radio" name="payType" value="CARTAO" className="hidden" checked={inPersonType === 'CARTAO'} onChange={() => setInPersonType('CARTAO')}/>
                                      <CreditCard />
                                      <span className="text-sm font-medium">Cartão (Mq)</span>
                                  </label>
                                  <label className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center gap-2 transition ${inPersonType === 'PIX' ? 'bg-slate-700 border-neon-orange text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                      <input type="radio" name="payType" value="PIX" className="hidden" checked={inPersonType === 'PIX'} onChange={() => setInPersonType('PIX')}/>
                                      <Smartphone />
                                      <span className="text-sm font-medium">Pix (Loja)</span>
                                  </label>
                              </div>
                          </div>
                      </div>
                  )}

                  <div className="mt-8 pt-6 border-t border-slate-800">
                     <button 
                      onClick={handlePayment}
                      disabled={isProcessing}
                      className={`w-full py-4 text-white font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.3)] transition transform hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${paymentTab === 'IN_PERSON' ? 'bg-green-600 hover:bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-gradient-to-r from-neon-orange to-amber-500 hover:shadow-[0_0_30px_rgba(249,115,22,0.5)]'}`}
                     >
                       {isProcessing ? (
                         <>
                           <Loader2 className="animate-spin" /> Processando...
                         </>
                       ) : (
                         <>
                            {paymentTab === 'IN_PERSON' ? 'Confirmar Recebimento ' : (integrationActive ? 'Pagar com Mercado Pago ' : 'Pagar ')}
                            {reservationData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                         </>
                       )}
                     </button>
                     {paymentTab === 'ONLINE' && (
                         <p className="text-center text-xs text-slate-500 mt-4 flex items-center justify-center gap-1">
                           <ExternalLink size={12} /> Você será redirecionado para um ambiente externo seguro.
                         </p>
                     )}
                  </div>

               </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Checkout;
