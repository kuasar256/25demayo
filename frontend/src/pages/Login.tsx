import { FormEvent, useState, useEffect } from 'react';
import { Crown, ArrowRight, Zap, Sun, Moon, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

const BG_IMAGES = [
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?q=80&w=1920&auto=format&fit=crop',
];

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [emailIsValid, setEmailIsValid] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [currentBg, setCurrentBg] = useState(0);
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % BG_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  async function loginWithCredentials(e_mail: string, pass: string) {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: e_mail, password: pass });
      setAuth(data.accessToken, data.user);
      navigate('/');
    } catch (err: any) {
      const message = err.response?.data?.message;
      setError(!err.response
        ? 'No se pudo conectar con el servidor. Comprueba que el backend esté iniciado e inténtalo de nuevo.'
        : Array.isArray(message) ? message.join('. ') : message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    loginWithCredentials(email, password);
  }

  async function requestPasswordReset(e: FormEvent) {
    e.preventDefault();
    setRecoveryLoading(true);
    setRecoveryMessage('');
    setRecoveryError('');
    try {
      await api.post('/auth/recover', { email: recoveryEmail });
      setRecoveryMessage('Si la cuenta está registrada, el administrador revisará tu solicitud. Coordina con él para recibir tu nueva contraseña.');
    } catch {
      setRecoveryError('No se pudo enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      setRecoveryLoading(false);
    }
  }

  const DEMO_USERS = import.meta.env.DEV ? [
    { label: 'Dueño', sub: 'Admin General', email: 'duenio@colchones.bo', color: 'bg-primary' },
    { label: 'Fábrica', sub: 'Enc. Producción', email: 'fabrica@colchones.bo', color: 'bg-secondary' },
    { label: 'Vendedor', sub: 'Sucursal Centro', email: 'vendedor1@colchones.bo', color: 'bg-success' },
  ] : [];

  return (
    <div className="min-h-screen relative overflow-hidden">
      <button
        type="button"
        onClick={() => setDark((value) => !value)}
        aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
        title={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
        className="fixed right-4 top-4 z-50 rounded-xl border border-line bg-white p-3 text-ink shadow-card dark:bg-surface"
      >
        {dark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
      {/* Slideshow background */}
      {BG_IMAGES.map((img, i) => (
        <div
          key={i}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-[2000ms] ease-in-out"
          style={{
            backgroundImage: `url(${img})`,
            opacity: currentBg === i ? 1 : 0,
          }}
        />
      ))}

      {/* Dark overlay on the image */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Diagonal shape - the white/form side */}
      <div
        className="absolute top-0 right-0 h-full bg-white dark:bg-page"
        style={{
          width: '55%',
          clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)',
        }}
      />

      {/* Content wrapper */}
      <div className="relative z-10 min-h-screen flex">
        {/* Left side - Branding over the slideshow */}
        <div className="hidden md:flex w-[45%] flex-col justify-center px-12 lg:px-16 text-white">
          <div className="max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mb-6 border border-white/20 shadow-xl">
              <Crown size={36} />
            </div>

            <h1 className="text-4xl font-bold leading-tight mb-3">
              COLCHONES<br />25 DE MAYO
            </h1>
            <p className="text-white/70 text-sm font-medium tracking-widest uppercase mb-8">
              Fábrica & Venta de Colchones
            </p>

            <div className="space-y-3 text-sm text-white/80">
              <p>✓ Control de inventario en fábrica y sucursales</p>
              <p>✓ Registro de ventas en tiempo real</p>
              <p>✓ Transferencias y logística integrada</p>
              <p>✓ Reportes gerenciales de ingresos</p>
            </div>

            {/* Slideshow dots */}
            <div className="flex gap-2 mt-10">
              {BG_IMAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentBg(i)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    currentBg === i ? 'w-8 bg-white' : 'w-3 bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 pt-12 pb-4 md:px-12 lg:px-16">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="md:hidden text-center mb-8">
              <div className="w-14 h-14 mx-auto rounded-xl bg-primary text-white flex items-center justify-center shadow-lg mb-3">
                <Crown size={28} />
              </div>
              <h1 className="text-xl font-bold text-ink">COLCHONES 25 DE MAYO</h1>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-ink">Iniciar Sesión</h2>
              <p className="text-sm text-muted mt-1">Ingrese sus credenciales para acceder.</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Correo</label>
                <input
                  className="input py-3"
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  aria-describedby="login-email-status"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailIsValid(e.target.value.length > 0 && e.target.validity.valid);
                  }}
                  placeholder="tu@correo.com"
                />
                <div id="login-email-status" aria-live="polite" aria-atomic="true">
                  {emailIsValid && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success">
                      <CheckCircle2 size={15} aria-hidden="true" /> Correo válido
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Contraseña</label>
                <div className="relative">
                  <input
                    id="login-password"
                    className="input py-3 pr-12"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                    aria-controls="login-password"
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-4 py-2.5">{error}</p>
              )}

              <button
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base"
                disabled={loading}
              >
                {loading ? 'Ingresando...' : (
                  <>Ingresar <ArrowRight size={18} /></>
                )}
              </button>
            </form>

            <div className="mt-4">
              <button
                type="button"
                className="text-sm text-secondary hover:underline"
                onClick={() => {
                  setShowRecovery((shown) => !shown);
                  setRecoveryEmail(email);
                  setRecoveryMessage('');
                  setRecoveryError('');
                }}
              >
                ¿Olvidaste tu contraseña o necesitas cambiarla?
              </button>
              {showRecovery && (
                <form onSubmit={requestPasswordReset} className="mt-3 space-y-3 rounded-xl border border-line bg-white/80 p-4 dark:bg-surface/80">
                  <p className="text-xs text-muted">
                    Envía una solicitud al administrador para que te asigne una nueva contraseña.
                  </p>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
                    Correo de tu cuenta
                    <input
                      className="input mt-2"
                      type="email"
                      autoComplete="email"
                      required
                      value={recoveryEmail}
                      onChange={(event) => setRecoveryEmail(event.target.value)}
                      placeholder="tu@correo.com"
                    />
                  </label>
                  {recoveryMessage && <p role="status" className="text-sm text-success">{recoveryMessage}</p>}
                  {recoveryError && <p role="alert" className="text-sm text-danger">{recoveryError}</p>}
                  <button className="btn-secondary w-full" disabled={recoveryLoading}>
                    {recoveryLoading ? 'Enviando solicitud…' : 'Solicitar nueva contraseña'}
                  </button>
                </form>
              )}
            </div>

            {/* Demo disponible solamente en desarrollo */}
            {import.meta.env.DEV && <div className="mt-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-line" />
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-1">
                  <Zap size={10} /> Demostración
                </span>
                <div className="flex-1 h-px bg-line" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {DEMO_USERS.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => loginWithCredentials(d.email, 'admin123')}
                    disabled={loading}
                    className="group border border-line hover:border-primary/40 rounded-xl py-2.5 px-1 text-center transition-all hover:shadow-sm bg-white dark:bg-transparent"
                  >
                    <div className={`w-7 h-7 mx-auto ${d.color} rounded-lg flex items-center justify-center text-white text-[10px] font-bold mb-1.5`}>
                      {d.label.charAt(0)}
                    </div>
                    <p className="text-[11px] font-semibold text-ink">{d.label}</p>
                    <p className="text-[9px] text-muted">{d.sub}</p>
                  </button>
                ))}
              </div>
            </div>}

            <p className="text-center text-[10px] text-muted mt-8">
              © {new Date().getFullYear()} Colchones 25 de Mayo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


