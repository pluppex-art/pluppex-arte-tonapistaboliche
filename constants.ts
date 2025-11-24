

import { EventType, FunnelStage, ReservationStatus, UserRole, AppSettings, User } from './types';

export const MOCK_DELAY = 500;

export const EVENT_TYPES = Object.values(EventType);
export const FUNNEL_STAGES = Object.values(FunnelStage);
export const STATUSES = Object.values(ReservationStatus);
export const TAGS = ['Lead novo', 'Cliente recorrente', 'Aniversário', 'Empresa', 'VIP', 'Frio', 'Quente'];

const DEFAULT_HOURS = Array(7).fill({
  isOpen: true,
  start: 18,
  end: 0 
});

DEFAULT_HOURS[0] = { isOpen: true, start: 16, end: 0 }; 
DEFAULT_HOURS[5] = { isOpen: true, start: 18, end: 2 }; 
DEFAULT_HOURS[6] = { isOpen: true, start: 16, end: 2 }; 

export const INITIAL_SETTINGS: AppSettings = {
  establishmentName: 'Tô Na Pista Boliche',
  address: 'Av. das Américas, 5000 - Barra da Tijuca',
  phone: '(21) 99999-9999',
  whatsappLink: 'https://wa.me/5521999999999',
  logoUrl: '',
  activeLanes: 6,
  weekdayPrice: 140, 
  weekendPrice: 160, 
  onlinePaymentEnabled: false,
  mercadopagoPublicKey: 'APP_USR-598f3b9a-91d1-419e-9b82-53b7afccd6e9', 
  mercadopagoAccessToken: '',
  mercadopagoClientId: '',      
  mercadopagoClientSecret: '',  
  businessHours: DEFAULT_HOURS
};

// Definição das chaves de permissão para facilitar a UI
export const PERMISSION_KEYS: { key: keyof User; label: string }[] = [
  { key: 'perm_view_agenda', label: 'Ver Agenda/Dashboard' },
  { key: 'perm_view_financial', label: 'Acesso Financeiro' },
  { key: 'perm_view_crm', label: 'Acesso Clientes (CRM)' },
  { key: 'perm_create_reservation', label: 'Criar Reservas' },
  { key: 'perm_edit_reservation', label: 'Editar Reservas' },
  { key: 'perm_delete_reservation', label: 'Excluir/Cancelar Reservas' },
  { key: 'perm_edit_client', label: 'Editar Clientes' },
  { key: 'perm_receive_payment', label: 'Receber Pagamentos (Checkout)' },
];

export const SEED_USERS: User[] = [
  {
    id: 'u1',
    name: 'Admin Master',
    email: 'admin@tonapista.com',
    role: UserRole.ADMIN,
    passwordHash: '123456',
    // Admin tem tudo true por padrão na lógica do App, mas aqui preenchemos
    perm_view_agenda: true,
    perm_view_financial: true,
    perm_view_crm: true,
    perm_create_reservation: true,
    perm_edit_reservation: true,
    perm_delete_reservation: true,
    perm_edit_client: true,
    perm_receive_payment: true
  }
];

export const FIRST_NAMES = [];
export const LAST_NAMES = [];
export const SEED_CLIENTS = [];
export const SEED_RESERVATIONS = [];
export const SEED_FUNNEL = [];