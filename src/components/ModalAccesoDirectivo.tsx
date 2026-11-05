import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { USUARIOS_DIRECTIVOS } from '../data/seedNotiprofes40';
import { RolUsuario, UsuarioDirectivo } from '../types/notiprofes';
import { DropdownPersonalizado } from './DropdownPersonalizado';

interface ModalAccesoDirectivoProps {
  abierto: boolean;
  onCerrar: () => void;
  onAutenticarExito: (token: string, usuario: UsuarioDirectivo) => void;
  onConsultaPublica?: () => void;
}

const ROLES_REGISTRO: Array<{
  valor: RolUsuario;
  etiqueta: string;
  subtitulo: string;
  colorPunto: string;
}> = [
  {
    valor: 'editor',
    etiqueta: 'Editor',
    subtitulo: 'Edición y programación de actividades',
    colorPunto: 'bg-[#007DC5]',
  },
  {
    valor: 'administrador',
    etiqueta: 'Administrador',
    subtitulo: 'Gestión total de usuarios, emisión y control',
    colorPunto: 'bg-purple-600',
  },
];

export const ModalAccesoDirectivo: React.FC<ModalAccesoDirectivoProps> = ({
  abierto,
  onCerrar,
  onAutenticarExito,
  onConsultaPublica,
}) => {
  const [identificador, setIdentificador] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [verPassword, setVerPassword] = useState<boolean>(false);
  const [mostrarAyudaPassword, setMostrarAyudaPassword] = useState<boolean>(false);
  const [modoRegistro, setModoRegistro] = useState<boolean>(false);

  // Lista de perfiles cargados desde el servidor
  const [listaUsuarios, setListaUsuarios] = useState<UsuarioDirectivo[]>(USUARIOS_DIRECTIVOS);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState<boolean>(false);

  // Campos para Registro de nuevo docente
  const [regNombre, setRegNombre] = useState<string>('');
  const [regCargo, setRegCargo] = useState<string>('');
  const [regRol, setRegRol] = useState<RolUsuario>('editor');
  const [regCorreo, setRegCorreo] = useState<string>('');
  const [regPin, setRegPin] = useState<string>('');
  const [menuRolAbierto, setMenuRolAbierto] = useState<boolean>(false);
  const selectorRolRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const manejarClickFuera = (e: MouseEvent) => {
      if (
        selectorRolRef.current &&
        !selectorRolRef.current.contains(e.target as Node)
      ) {
        setMenuRolAbierto(false);
      }
    };

    if (menuRolAbierto) {
      document.addEventListener('mousedown', manejarClickFuera);
    }
    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
    };
  }, [menuRolAbierto]);

  useEffect(() => {
    if (abierto) {
      setError(null);
      setMostrarAyudaPassword(false);
      fetch('/api/auth/perfiles')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.perfiles) && data.perfiles.length > 0) {
            setListaUsuarios(data.perfiles);
          }
        })
        .catch(() => {
          // Mantiene la lista local si el servidor tarda en responder
        });
    }
  }, [abierto]);

  if (!abierto) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identificador.trim()) {
      setError('Por favor ingrese su usuario o correo electrónico.');
      return;
    }
    if (!password.trim()) {
      setError('Por favor ingrese su contraseña o PIN.');
      return;
    }

    setCargando(true);

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: identificador.trim(),
          pin: password.trim(),
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'Credenciales no válidas. Verifique sus datos.');
        setCargando(false);
        return;
      }

      onAutenticarExito(data.token, data.usuario);
      onCerrar();
    } catch {
      setError('Error al conectar con el servidor institucional.');
    } finally {
      setCargando(false);
    }
  };

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!regNombre.trim()) {
      setError('Por favor ingrese su nombre completo.');
      return;
    }
    if (!regCargo.trim()) {
      setError('Por favor ingrese su cargo o área docente.');
      return;
    }
    if (!regPin.trim() || regPin.trim().length < 4) {
      setError('La contraseña/PIN debe tener al menos 4 caracteres.');
      return;
    }

    setCargando(true);

    try {
      const resp = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: regNombre.trim(),
          cargo: regCargo.trim(),
          rol: regRol,
          correo: regCorreo.trim(),
          pin: regPin.trim(),
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'No fue posible completar el registro.');
        setCargando(false);
        return;
      }

      onAutenticarExito(data.token, data.usuario);
      onCerrar();
    } catch {
      setError('Error al conectar con el servidor para registrar el perfil.');
    } finally {
      setCargando(false);
    }
  };

  const handleIrAConsultaPublica = () => {
    if (onConsultaPublica) {
      onConsultaPublica();
    } else {
      onCerrar();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-auth"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="max-w-[420px] w-full bg-[#0F223D] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/40 my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* CABECERA SUPERIOR OSCURA CON LOGO INSTITUCIONAL DESPEJADO */}
        <div className="bg-[#0F223D] px-6 pt-8 pb-4 flex flex-col items-center text-center relative shrink-0">
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar ventana de acceso"
            className="absolute top-3 right-3 z-20 p-1.5 rounded-full text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Logo institucional oficial con margen superior libre para no chocar con el botón cerrar */}
          <div className="w-full max-w-[330px] flex items-center justify-center mb-2.5 pointer-events-none select-none">
            <img
              src="/public/assets/aistudio/logo_html_859fb25c.png"
              alt="Institución Educativa Villa Flora"
              referrerPolicy="no-referrer"
              className="h-[58px] sm:h-[64px] w-auto max-w-full object-contain drop-shadow-sm pointer-events-none"
            />
          </div>

          {/* Título compacto en una sola línea sin textos redundantes */}
          <h2
            id="titulo-modal-auth"
            className="text-sm sm:text-base font-display font-extrabold tracking-wider uppercase text-sky-100"
          >
            NOTIPROFES DIGITAL
          </h2>

          {/* Franja dorada divisoria institucional */}
          <div className="w-full h-1 bg-amber-400 rounded-full mt-3" />
        </div>

        {/* CUERPO BLANCO DEL FORMULARIO */}
        <div className="bg-white px-6 py-6 space-y-4 rounded-b-3xl">
          {!modoRegistro ? (
            /* FORMULARIO DE INICIO DE SESIÓN */
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Campo: Usuario o correo electrónico */}
              <div>
                <label
                  htmlFor="input-auth-usuario"
                  className="block text-xs font-bold text-slate-800 mb-1.5"
                >
                  Usuario o correo electrónico
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="input-auth-usuario"
                    type="text"
                    autoComplete="username"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    placeholder="Usuario o correo"
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Campo: Contraseña con enlace ¿Olvidaste tu contraseña? y botón de ojo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="input-auth-contrasena"
                    className="block text-xs font-bold text-slate-800"
                  >
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => setMostrarAyudaPassword(!mostrarAyudaPassword)}
                    className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {mostrarAyudaPassword && (
                  <div className="p-2.5 mb-2 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 leading-relaxed animate-in fade-in duration-100">
                    Para restablecer su contraseña institucional o consultar su PIN individual, comuníquese con Rectoría o Coordinación. (PIN de prueba predeterminado: <strong>2026</strong> o según su rol).
                  </div>
                )}

                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="input-auth-contrasena"
                    type={verPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 font-mono-tabular focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword(!verPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    aria-label={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {verPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Mensaje de Error si aplica */}
              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium leading-relaxed"
                >
                  {error}
                </div>
              )}

              {/* Botón Principal: Iniciar sesión */}
              <button
                type="submit"
                disabled={cargando}
                className="w-full py-2 sm:py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-[#007DC5] hover:bg-[#034EA2] shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{cargando ? 'Verificando...' : 'Iniciar sesión'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Separador fino */}
              <div className="h-px bg-slate-100 my-0.5" />

              {/* Botón Secundario: Ir a Consulta Pública (Sin contraseña) */}
              <button
                type="button"
                onClick={handleIrAConsultaPublica}
                className="w-full py-1.5 sm:py-2 px-4 rounded-xl font-bold text-xs sm:text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Globe className="w-4 h-4 text-emerald-600" />
                <span>Ir a Consulta Pública (Sin contraseña)</span>
              </button>

              {/* Enlace para registrar nuevo usuario */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setModoRegistro(true);
                    setError(null);
                  }}
                  className="text-xs text-slate-500 hover:text-[#034EA2] font-semibold cursor-pointer"
                >
                  ¿No tienes perfil docente registrado?{' '}
                  <span className="text-blue-600 underline">Crear cuenta</span>
                </button>
              </div>
            </form>
          ) : (
            /* FORMULARIO DE REGISTRO DE NUEVO DOCENTE */
            <form onSubmit={handleRegistro} className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-800">
                  Registro de Nuevo Docente / Funcionario
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setModoRegistro(false);
                    setError(null);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Volver al login
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nombre completo:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={regNombre}
                    onChange={(e) => setRegNombre(e.target.value)}
                    placeholder="Ej: Gloria Elena Ramírez"
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Cargo o Área:
                  </label>
                  <input
                    type="text"
                    required
                    value={regCargo}
                    onChange={(e) => setRegCargo(e.target.value)}
                    placeholder="Ej: Docente Matemáticas"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Rol institucional:
                  </label>
                  <DropdownPersonalizado
                    modo="simple"
                    anchoCompleto
                    varianteBoton="campo"
                    ariaLabel="Rol institucional"
                    colorPuntoBoton={ROLES_REGISTRO.find((r) => r.valor === regRol)?.colorPunto}
                    etiquetaBoton={
                      ROLES_REGISTRO.find((r) => r.valor === regRol)?.etiqueta || 'Editor'
                    }
                    valorSeleccionado={regRol}
                    onChange={(val) => setRegRol(val as RolUsuario)}
                    opciones={ROLES_REGISTRO.map((r) => ({
                      valor: r.valor,
                      etiqueta: r.etiqueta,
                      descripcion: r.subtitulo,
                      colorPunto: r.colorPunto,
                    }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Correo institucional (opcional):
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={regCorreo}
                    onChange={(e) => setRegCorreo(e.target.value)}
                    placeholder="docente@ievillaflora.edu.co"
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Cree su contraseña o PIN (mín. 4 dígitos):
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value)}
                    placeholder="Ej: 1234"
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 font-mono-tabular focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium leading-relaxed"
                >
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModoRegistro(false)}
                  className="py-1.5 sm:py-2 px-4 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className="py-1.5 sm:py-2 px-5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                >
                  {cargando ? 'Registrando...' : 'Registrar y Acceder'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
