import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Pencil,
  PlugZap,
  Plus,
  Search,
  Send,
  Server,
  Shield,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { RolUsuario, UsuarioDirectivo } from '../types/notiprofes';
import { DropdownPersonalizado } from './DropdownPersonalizado';

interface ModalAdministracionUsuariosProps {
  abierto: boolean;
  onCerrar: () => void;
  usuarioActual: UsuarioDirectivo | null;
  tokenSesion?: string | null;
  onSolicitarLogin?: () => void;
  onUsuarioCreado?: (usuario: UsuarioDirectivo) => void;
}

const ROLES_INFO: Record<
  RolUsuario,
  {
    etiqueta: string;
    subtitulo: string;
    badgeClase: string;
    colorPunto: string;
  }
> = {
  administrador: {
    etiqueta: 'Administrador',
    subtitulo: 'Gestión total de usuarios, emisión y control',
    badgeClase: 'bg-purple-50 text-purple-800 border-purple-200',
    colorPunto: 'bg-purple-600',
  },
  editor: {
    etiqueta: 'Editor',
    subtitulo: 'Edición y programación de actividades',
    badgeClase: 'bg-sky-50 text-[#034EA2] border-sky-200',
    colorPunto: 'bg-[#007DC5]',
  },
};

export const ModalAdministracionUsuarios: React.FC<
  ModalAdministracionUsuariosProps
> = ({
  abierto,
  onCerrar,
  usuarioActual,
  tokenSesion,
  onSolicitarLogin,
  onUsuarioCreado,
}) => {
  const [usuarios, setUsuarios] = useState<UsuarioDirectivo[]>([]);
  const [busqueda, setBusqueda] = useState<string>('');
  const [tabActiva, setTabActiva] = useState<'lista' | 'nuevo' | 'smtp'>('lista');
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Formulario nuevo usuario
  const [nuevoNombre, setNuevoNombre] = useState<string>('');
  const [nuevoCargo, setNuevoCargo] = useState<string>('');
  const [nuevoRol, setNuevoRol] = useState<RolUsuario>('editor');
  const [nuevoCorreo, setNuevoCorreo] = useState<string>('');
  const [nuevoPin, setNuevoPin] = useState<string>('');

  // Estado para edición
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioDirectivo | null>(null);
  const [editNombre, setEditNombre] = useState<string>('');
  const [editCargo, setEditCargo] = useState<string>('');
  const [editRol, setEditRol] = useState<RolUsuario>('editor');
  const [editCorreo, setEditCorreo] = useState<string>('');
  const [editPin, setEditPin] = useState<string>('');

  // Estado para confirmación de eliminación
  const [usuarioAEliminar, setUsuarioAEliminar] = useState<UsuarioDirectivo | null>(null);

  // Estado para configuración de Servidor SMTP en tiempo real
  const [smtpHost, setSmtpHost] = useState<string>('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState<string>('587');
  const [smtpSecure, setSmtpSecure] = useState<boolean>(false);
  const [smtpUser, setSmtpUser] = useState<string>('');
  const [smtpPass, setSmtpPass] = useState<string>('');
  const [smtpFrom, setSmtpFrom] = useState<string>(
    'NotiProfes Digital I.E. Villa Flora <notiprofes@ievillaflora.edu.co>'
  );
  const [smtpCorreoPrueba, setSmtpCorreoPrueba] = useState<string>('');
  const [mostrarPasswordSmtp, setMostrarPasswordSmtp] = useState<boolean>(false);
  const [smtpConfiguradoEnServidor, setSmtpConfiguradoEnServidor] =
    useState<boolean>(false);
  const [tienePasswordGuardado, setTienePasswordGuardado] =
    useState<boolean>(false);
  const [smtpActualizadoEn, setSmtpActualizadoEn] = useState<string | null>(null);
  const [smtpActualizadoPor, setSmtpActualizadoPor] = useState<string | null>(
    null
  );
  const [guardandoSmtp, setGuardandoSmtp] = useState<boolean>(false);
  const [probandoSmtp, setProbandoSmtp] = useState<boolean>(false);
  const [resultadoPruebaSmtp, setResultadoPruebaSmtp] = useState<{
    tipo: 'ok' | 'error';
    texto: string;
  } | null>(null);

  const cargarUsuarios = async () => {
    setCargando(true);
    try {
      const headers: Record<string, string> = {};
      if (tokenSesion) {
        headers.Authorization = `Bearer ${tokenSesion}`;
      }
      const resp = await fetch('/api/auth/perfiles', { headers });
      const data = await resp.json();
      if (Array.isArray(data.perfiles)) {
        setUsuarios(data.perfiles);
      }
    } catch {
      // Manejar error silenciosamente
    } finally {
      setCargando(false);
    }
  };

  const cargarEstadoSmtp = async () => {
    if (!tokenSesion) return;
    try {
      const resp = await fetch('/api/notificaciones/smtp/estado', {
        headers: { Authorization: `Bearer ${tokenSesion}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setSmtpConfiguradoEnServidor(Boolean(data.servidorConfiguradoEnEntorno));
      if (data.hostConfigurado) setSmtpHost(data.hostConfigurado);
      if (data.puertoConfigurado) setSmtpPort(String(data.puertoConfigurado));
      if (typeof data.secureConfigurado === 'boolean') {
        setSmtpSecure(data.secureConfigurado);
      }
      if (data.usuarioConfigurado) setSmtpUser(data.usuarioConfigurado);
      if (data.remitenteConfigurado) setSmtpFrom(data.remitenteConfigurado);
      setTienePasswordGuardado(Boolean(data.tienePasswordConfigurado));
      setSmtpActualizadoEn(data.actualizadoEn || null);
      setSmtpActualizadoPor(data.actualizadoPor || null);
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    if (abierto) {
      cargarUsuarios();
      cargarEstadoSmtp();
      setError(null);
      setExito(null);
      setUsuarioEditando(null);
      setUsuarioAEliminar(null);
      setResultadoPruebaSmtp(null);
      if (usuarioActual?.correo && !smtpCorreoPrueba) {
        setSmtpCorreoPrueba(usuarioActual.correo);
      }
    }
  }, [abierto, tokenSesion]);

  if (!abierto) return null;

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExito(null);

    if (!nuevoNombre.trim() || !nuevoCargo.trim() || !nuevoPin.trim()) {
      setError('Por favor complete el nombre, cargo y PIN de acceso.');
      return;
    }

    if (nuevoPin.trim().length < 4) {
      setError('El PIN o contraseña debe contener mínimo 4 dígitos.');
      return;
    }

    setCargando(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (tokenSesion) {
        headers.Authorization = `Bearer ${tokenSesion}`;
      }
      const resp = await fetch('/api/auth/registro', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nombre: nuevoNombre.trim(),
          cargo: nuevoCargo.trim(),
          rol: nuevoRol,
          correo: nuevoCorreo.trim(),
          pin: nuevoPin.trim(),
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'No fue posible registrar al usuario.');
        return;
      }

      setExito(`Usuario institucional «${nuevoNombre.trim()}» registrado con éxito.`);
      setNuevoNombre('');
      setNuevoCargo('');
      setNuevoCorreo('');
      setNuevoPin('');
      setNuevoRol('editor');

      cargarUsuarios();
      if (onUsuarioCreado && data.usuario) {
        onUsuarioCreado(data.usuario);
      }

      setTimeout(() => {
        setTabActiva('lista');
        setExito(null);
      }, 1500);
    } catch {
      setError('Error al comunicar con el servidor institucional.');
    } finally {
      setCargando(false);
    }
  };

  const handleIniciarEdicion = (u: UsuarioDirectivo) => {
    setUsuarioEditando(u);
    setEditNombre(u.nombre);
    setEditCargo(u.cargo);
    setEditRol(u.rol);
    setEditCorreo(u.correo || '');
    setEditPin('');
    setError(null);
    setExito(null);
  };

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioEditando) return;
    setError(null);
    setExito(null);

    if (!editNombre.trim() || !editCargo.trim()) {
      setError('Por favor complete el nombre y el cargo institucional.');
      return;
    }

    if (editPin.trim() && editPin.trim().length < 4) {
      setError('Si va a actualizar la contraseña, debe tener al menos 4 dígitos.');
      return;
    }

    if (!tokenSesion) {
      if (onSolicitarLogin) {
        onSolicitarLogin();
      } else {
        setError('Inicie sesión con su cuenta de Administrador para editar usuarios.');
      }
      return;
    }

    setCargando(true);
    try {
      const resp = await fetch(`/api/auth/perfiles/${usuarioEditando.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify({
          nombre: editNombre.trim(),
          cargo: editCargo.trim(),
          rol: editRol,
          correo: editCorreo.trim(),
          pin: editPin.trim() || undefined,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'No fue posible actualizar la información del usuario.');
        return;
      }

      setExito(`Perfil de «${editNombre.trim()}» actualizado con éxito.`);
      setUsuarioEditando(null);
      cargarUsuarios();
    } catch {
      setError('Error al comunicar con el servidor institucional.');
    } finally {
      setCargando(false);
    }
  };

  const handleConfirmarEliminacion = async () => {
    if (!usuarioAEliminar) return;
    setError(null);
    setExito(null);

    if (!tokenSesion) {
      if (onSolicitarLogin) {
        onSolicitarLogin();
      } else {
        setError('Inicie sesión con su cuenta de Administrador para eliminar usuarios.');
      }
      return;
    }

    setCargando(true);

    try {
      const resp = await fetch(`/api/auth/perfiles/${usuarioAEliminar.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokenSesion}`,
        },
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'No fue posible eliminar el usuario.');
        return;
      }

      setExito(`Usuario «${usuarioAEliminar.nombre}» eliminado correctamente.`);
      setUsuarioAEliminar(null);
      cargarUsuarios();
    } catch {
      setError('Error al comunicar con el servidor institucional.');
    } finally {
      setCargando(false);
    }
  };

  const handleGuardarConfiguracionSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExito(null);
    setResultadoPruebaSmtp(null);

    if (!tokenSesion) {
      if (onSolicitarLogin) {
        onSolicitarLogin();
      } else {
        setError('Inicie sesión con su cuenta directiva para actualizar los parámetros SMTP.');
      }
      return;
    }

    if (!smtpHost.trim() || !smtpUser.trim()) {
      setError('Debe indicar el Host del servidor SMTP y el Usuario de autenticación.');
      return;
    }

    if (!smtpPass.trim() && !tienePasswordGuardado) {
      setError('Ingrese la contraseña o clave de aplicación SMTP para activar el servidor.');
      return;
    }

    setGuardandoSmtp(true);
    try {
      const resp = await fetch('/api/notificaciones/smtp/configuracion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify({
          host: smtpHost.trim(),
          port: Number(smtpPort) || 587,
          secure: smtpSecure,
          user: smtpUser.trim(),
          pass: smtpPass.trim() || undefined,
          from:
            smtpFrom.trim() ||
            `NotiProfes Digital I.E. Villa Flora <${smtpUser.trim()}>`,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'No fue posible guardar la configuración SMTP.');
        return;
      }

      setSmtpConfiguradoEnServidor(Boolean(data.servidorConfiguradoEnEntorno));
      setTienePasswordGuardado(Boolean(data.tienePasswordConfigurado));
      setSmtpActualizadoEn(data.actualizadoEn || null);
      setSmtpActualizadoPor(data.actualizadoPor || null);
      setSmtpPass('');
      setExito(
        data.mensaje ||
          'Parámetros del servidor SMTP actualizados en tiempo real.'
      );
    } catch {
      setError('Error de red al guardar los parámetros del servidor SMTP.');
    } finally {
      setGuardandoSmtp(false);
    }
  };

  const handleProbarConexionSmtp = async () => {
    setError(null);
    setExito(null);
    setResultadoPruebaSmtp(null);

    if (!tokenSesion) {
      if (onSolicitarLogin) {
        onSolicitarLogin();
      } else {
        setError('Inicie sesión con su cuenta directiva para probar la conexión SMTP.');
      }
      return;
    }

    if (!smtpHost.trim() || !smtpUser.trim()) {
      setResultadoPruebaSmtp({
        tipo: 'error',
        texto: 'Ingrese el Servidor (Host) y el Usuario SMTP antes de ejecutar la prueba.',
      });
      return;
    }

    if (!smtpPass.trim() && !tienePasswordGuardado) {
      setResultadoPruebaSmtp({
        tipo: 'error',
        texto: 'Ingrese la Contraseña o Clave de Aplicación SMTP para validar la conexión.',
      });
      return;
    }

    setProbandoSmtp(true);
    try {
      const resp = await fetch('/api/notificaciones/smtp/probar-conexion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSesion}`,
        },
        body: JSON.stringify({
          host: smtpHost.trim(),
          port: Number(smtpPort) || 587,
          secure: smtpSecure,
          user: smtpUser.trim(),
          pass: smtpPass.trim() || undefined,
          from:
            smtpFrom.trim() ||
            `NotiProfes Digital I.E. Villa Flora <${smtpUser.trim()}>`,
          correoPrueba: smtpCorreoPrueba.trim() || undefined,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setResultadoPruebaSmtp({
          tipo: 'error',
          texto: data.error || 'La prueba de conexión SMTP falló.',
        });
        return;
      }

      setResultadoPruebaSmtp({
        tipo: 'ok',
        texto:
          data.mensaje ||
          'Conexión SMTP verificada satisfactoriamente en tiempo real.',
      });
    } catch {
      setResultadoPruebaSmtp({
        tipo: 'error',
        texto: 'Error de comunicación con el servidor al intentar validar el SMTP.',
      });
    } finally {
      setProbandoSmtp(false);
    }
  };

  const aplicarPresetProveedorSmtp = (
    proveedor: 'gmail' | 'office365' | 'ssl465'
  ) => {
    setResultadoPruebaSmtp(null);
    if (proveedor === 'gmail') {
      setSmtpHost('smtp.gmail.com');
      setSmtpPort('587');
      setSmtpSecure(false);
    } else if (proveedor === 'office365') {
      setSmtpHost('smtp.office365.com');
      setSmtpPort('587');
      setSmtpSecure(false);
    } else {
      setSmtpPort('465');
      setSmtpSecure(true);
    }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      u.nombre.toLowerCase().includes(q) ||
      u.cargo.toLowerCase().includes(q) ||
      Boolean(u.usuario && u.usuario.toLowerCase().includes(q)) ||
      (u.correo && u.correo.toLowerCase().includes(q))
    );
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-usuarios"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div className="max-w-2xl w-full bg-[#0F223D] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60 my-auto animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] relative">
        {/* CABECERA INSTITUCIONAL */}
        <div className="bg-[#0F223D] px-6 pt-6 pb-4 flex flex-col relative shrink-0">
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar administración de usuarios"
            className="absolute top-4 right-4 z-20 p-2 rounded-full text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 transition-all cursor-pointer shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#007DC5]/20 border border-[#007DC5]/40 flex items-center justify-center text-[#007DC5] shrink-0">
              <Users className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2
                id="titulo-modal-usuarios"
                className="text-lg sm:text-xl font-display font-extrabold text-white tracking-tight leading-tight"
              >
                Administración de Usuarios
              </h2>
              <p className="text-xs text-sky-200/80 font-medium">
                Directorio institucional y gestión de roles · I.E. Villa Flora
              </p>
            </div>
          </div>

          {/* Franja dorada decorativa */}
          <div className="w-full h-1 bg-amber-400 rounded-full mt-2" />

          {/* Pestañas de navegación */}
          <div className="flex items-center gap-2 mt-4 pt-1 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setTabActiva('lista');
                setUsuarioEditando(null);
                setError(null);
                setExito(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                tabActiva === 'lista' && !usuarioEditando
                  ? 'bg-white text-[#0F223D] shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Directorio ({usuarios.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTabActiva('nuevo');
                setUsuarioEditando(null);
                setError(null);
                setExito(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                tabActiva === 'nuevo' && !usuarioEditando
                  ? 'bg-white text-[#0F223D] shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Nuevo Funcionario</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTabActiva('smtp');
                setUsuarioEditando(null);
                setError(null);
                setExito(null);
                setResultadoPruebaSmtp(null);
                cargarEstadoSmtp();
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                tabActiva === 'smtp' && !usuarioEditando
                  ? 'bg-white text-[#0F223D] shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span>Servidor SMTP</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  smtpConfiguradoEnServidor ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                title={
                  smtpConfiguradoEnServidor
                    ? 'Servidor SMTP configurado'
                    : 'Pendiente de configurar'
                }
              />
            </button>
          </div>
        </div>

        {/* CUERPO BLANCO MODAL */}
        <div className="bg-white p-5 sm:p-6 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium"
            >
              {error}
            </div>
          )}

          {exito && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium"
            >
              {exito}
            </div>
          )}

          {usuarioEditando ? (
            /* FORMULARIO DE EDICIÓN DE USUARIO EXISTENTE */
            <form onSubmit={handleGuardarEdicion} className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUsuarioEditando(null)}
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                    title="Volver al directorio"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-800">
                    Editando perfil de «{usuarioEditando.nombre}»
                  </span>
                </div>
                <span className="text-[10px] font-mono-tabular text-slate-400">
                  ID: {usuarioEditando.id}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nombre completo:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    placeholder="Nombre y apellidos"
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Cargo institucional:
                  </label>
                  <input
                    type="text"
                    required
                    value={editCargo}
                    onChange={(e) => setEditCargo(e.target.value)}
                    placeholder="Ej: Docente Matemáticas"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
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
                    ariaLabel="Rol en boletín"
                    icono={<Shield className="w-4 h-4 text-[#034EA2]" />}
                    colorPuntoBoton={ROLES_INFO[editRol]?.colorPunto}
                    etiquetaBoton={ROLES_INFO[editRol]?.etiqueta || 'Editor'}
                    valorSeleccionado={editRol}
                    onChange={(val) => setEditRol(val as RolUsuario)}
                    opciones={Object.entries(ROLES_INFO).map(([rolKey, info]) => ({
                      valor: rolKey,
                      etiqueta: info.etiqueta,
                      descripcion: info.subtitulo,
                      colorPunto: info.colorPunto,
                    }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Correo electrónico:
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={editCorreo}
                    onChange={(e) => setEditCorreo(e.target.value)}
                    placeholder="correo@ievillaflora.edu.co"
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nueva contraseña o PIN (dejar en blanco para mantener la actual):
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value)}
                    placeholder="Mínimo 4 dígitos para actualizar"
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 font-mono-tabular focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUsuarioEditando(null)}
                  className="py-1.5 px-4 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className="py-1.5 px-5 text-xs font-bold text-white bg-[#034EA2] hover:bg-[#007DC5] rounded-xl disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                >
                  {cargando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          ) : tabActiva === 'lista' ? (
            <>
              {/* Buscador de usuarios */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, cargo, usuario o correo..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium text-slate-800"
                />
              </div>

              {/* Lista de usuarios con botones de Edición y Eliminación */}
              <div className="space-y-2">
                {usuariosFiltrados.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </div>
                ) : (
                  usuariosFiltrados.map((u) => {
                    const infoRol = ROLES_INFO[u.rol] || ROLES_INFO.editor;
                    const esActual = usuarioActual?.id === u.id;

                    return (
                      <div
                        key={u.id}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          esActual
                            ? 'bg-sky-50/70 border-sky-200/90 shadow-2xs'
                            : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar con iniciales y color institucional */}
                          <div
                            style={{ backgroundColor: u.color || '#007DC5' }}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
                          >
                            {u.nombre
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((p) => p[0])
                              .join('')
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-[#0F172A] truncate">
                                {u.nombre}
                              </span>
                              {esActual && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#034EA2] text-white">
                                  Tú
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-medium text-slate-500 truncate">
                              {u.cargo}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              Usuario: <strong className="font-semibold text-slate-600">{u.usuario}</strong>
                              {u.correo && (
                                <> · <span>{u.correo}</span></>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Rol badge + Acciones (Editar y Eliminar) */}
                        <div className="shrink-0 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${infoRol.badgeClase}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${infoRol.colorPunto}`}
                            />
                            <span>{infoRol.etiqueta}</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => handleIniciarEdicion(u)}
                            title="Editar usuario"
                            className="p-1.5 rounded-lg border border-slate-200/90 hover:border-[#007DC5] text-slate-600 hover:text-[#007DC5] hover:bg-sky-50/80 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setUsuarioAEliminar(u)}
                            title="Eliminar usuario"
                            className="p-1.5 rounded-lg border border-rose-200/90 hover:border-rose-400 text-rose-600 hover:text-rose-700 hover:bg-rose-50/80 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : tabActiva === 'nuevo' ? (
            /* FORMULARIO DE REGISTRO DIRECTO */
            <form onSubmit={handleCrearUsuario} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nombre completo:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    placeholder="Ej: Patricia Morales Zapata"
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Cargo institucional:
                  </label>
                  <input
                    type="text"
                    required
                    value={nuevoCargo}
                    onChange={(e) => setNuevoCargo(e.target.value)}
                    placeholder="Ej: Docente Ciencias Naturales"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Rol en boletín:
                  </label>
                  <DropdownPersonalizado
                    modo="simple"
                    anchoCompleto
                    varianteBoton="campo"
                    ariaLabel="Rol en boletín"
                    icono={<Shield className="w-4 h-4 text-[#034EA2]" />}
                    colorPuntoBoton={ROLES_INFO[nuevoRol]?.colorPunto}
                    etiquetaBoton={ROLES_INFO[nuevoRol]?.etiqueta || 'Editor'}
                    valorSeleccionado={nuevoRol}
                    onChange={(val) => setNuevoRol(val as RolUsuario)}
                    opciones={Object.entries(ROLES_INFO).map(([rolKey, info]) => ({
                      valor: rolKey,
                      etiqueta: info.etiqueta,
                      descripcion: info.subtitulo,
                      colorPunto: info.colorPunto,
                    }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Correo electrónico (opcional):
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={nuevoCorreo}
                    onChange={(e) => setNuevoCorreo(e.target.value)}
                    placeholder="docente@ievillaflora.edu.co"
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  PIN o contraseña de acceso (mín. 4 dígitos):
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={nuevoPin}
                    onChange={(e) => setNuevoPin(e.target.value)}
                    placeholder="Ej: 2026"
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 font-mono-tabular focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTabActiva('lista')}
                  className="py-1.5 px-4 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  className="py-1.5 px-5 text-xs font-bold text-white bg-[#034EA2] hover:bg-[#007DC5] rounded-xl disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                >
                  {cargando ? 'Guardando...' : 'Guardar y Registrar'}
                </button>
              </div>
            </form>
          ) : (
            /* PANEL DE CONFIGURACIÓN DE SERVIDOR SMTP EN TIEMPO REAL */
            <form onSubmit={handleGuardarConfiguracionSmtp} className="space-y-4">
              {/* Estado general y plantillas rápidas de proveedor */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-[#0F172A] flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-[#034EA2]" />
                      Parámetros de Salida SMTP (Tiempo Real)
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        smtpConfiguradoEnServidor
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          smtpConfiguradoEnServidor
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      {smtpConfiguradoEnServidor
                        ? 'Servidor Activo'
                        : 'Pendiente de Credenciales'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Las credenciales se almacenan cifradas/protegidas en el backend (<code>/app/data</code>) sin exponer la clave en el navegador.
                  </p>
                  {smtpActualizadoEn && (
                    <p className="text-[10px] text-slate-400 font-medium">
                      Última actualización: <strong>{smtpActualizadoEn}</strong>
                      {smtpActualizadoPor ? ` por ${smtpActualizadoPor}` : ''}
                    </p>
                  )}
                </div>

                {/* Botones rápidos de autocompletado de Host/Puerto */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => aplicarPresetProveedorSmtp('gmail')}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-700 hover:border-[#007DC5] hover:text-[#034EA2] transition-colors cursor-pointer"
                    title="Autocompletar smtp.gmail.com (Puerto 587 STARTTLS)"
                  >
                    Gmail / Workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetProveedorSmtp('office365')}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-700 hover:border-[#007DC5] hover:text-[#034EA2] transition-colors cursor-pointer"
                    title="Autocompletar smtp.office365.com (Puerto 587 STARTTLS)"
                  >
                    Office 365
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetProveedorSmtp('ssl465')}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-700 hover:border-[#007DC5] hover:text-[#034EA2] transition-colors cursor-pointer"
                    title="Configurar Puerto 465 con SSL/TLS directo"
                  >
                    SSL (465)
                  </button>
                </div>
              </div>

              {!tokenSesion && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
                  <span>
                    Para guardar cambios o probar la conexión con el servidor SMTP debe contar con una sesión directiva activa.
                  </span>
                  {onSolicitarLogin && (
                    <button
                      type="button"
                      onClick={onSolicitarLogin}
                      className="px-3 py-1.5 rounded-lg bg-[#034EA2] hover:bg-[#007DC5] text-white font-bold text-xs shrink-0 cursor-pointer"
                    >
                      Iniciar Sesión
                    </button>
                  )}
                </div>
              )}

              {/* Fila 1: Servidor Host, Puerto y Seguridad */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Servidor SMTP (Host):
                  </label>
                  <div className="relative">
                    <Server className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="Ej: smtp.gmail.com"
                      className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 font-mono-tabular focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Puerto:
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={smtpPort}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSmtpPort(val);
                      if (val === '465') setSmtpSecure(true);
                      if (val === '587' || val === '25') setSmtpSecure(false);
                    }}
                    placeholder="587"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 font-mono-tabular focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>

                <div className="sm:col-span-3 flex flex-col justify-end">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Cifrado:
                  </label>
                  <button
                    type="button"
                    onClick={() => setSmtpSecure((prev) => !prev)}
                    className={`w-full py-1.5 px-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      smtpSecure
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-sky-50 border-sky-200 text-[#034EA2]'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{smtpSecure ? 'SSL/TLS (465)' : 'STARTTLS (587)'}</span>
                  </button>
                </div>
              </div>

              {/* Fila 2: Usuario y Contraseña SMTP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Usuario / Correo SMTP:
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="notiprofes@ievillaflora.edu.co"
                      className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Contraseña o Clave de Aplicación:
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={mostrarPasswordSmtp ? 'text' : 'password'}
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder={
                        tienePasswordGuardado
                          ? '•••••••• (Guardada — escriba para cambiar)'
                          : 'Clave de aplicación de 16 caracteres'
                      }
                      className="w-full pl-9 pr-9 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 font-mono-tabular focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPasswordSmtp((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={
                        mostrarPasswordSmtp
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                    >
                      {mostrarPasswordSmtp ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Fila 3: Remitente institucional y Correo para prueba en vivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Remitente Visible (From):
                  </label>
                  <input
                    type="text"
                    value={smtpFrom}
                    onChange={(e) => setSmtpFrom(e.target.value)}
                    placeholder="NotiProfes Digital I.E. Villa Flora <notiprofes@ievillaflora.edu.co>"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Enviar correo de prueba a (opcional al validar):
                  </label>
                  <div className="relative">
                    <Send className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={smtpCorreoPrueba}
                      onChange={(e) => setSmtpCorreoPrueba(e.target.value)}
                      placeholder="rectoria@ievillaflora.edu.co"
                      className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#007DC5] focus:ring-1 focus:ring-[#007DC5]/20 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Resultado de la prueba de conexión en tiempo real */}
              {resultadoPruebaSmtp && (
                <div
                  role="status"
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
                    resultadoPruebaSmtp.tipo === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {resultadoPruebaSmtp.tipo === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{resultadoPruebaSmtp.texto}</span>
                </div>
              )}

              {/* Botones de acción: Probar Conexión y Guardar Parámetros */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleProbarConexionSmtp}
                  disabled={probandoSmtp || guardandoSmtp}
                  className="py-2 px-4 text-xs font-bold text-[#034EA2] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl disabled:opacity-50 transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <PlugZap className="w-4 h-4 text-[#007DC5]" />
                  <span>
                    {probandoSmtp
                      ? 'Validando conexión SMTP...'
                      : 'Probar Conexión SMTP'}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTabActiva('lista')}
                    className="py-2 px-4 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Volver al Directorio
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoSmtp || probandoSmtp}
                    className="py-2 px-5 text-xs font-bold text-white bg-[#034EA2] hover:bg-[#007DC5] rounded-xl disabled:opacity-50 transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>
                      {guardandoSmtp
                        ? 'Guardando...'
                        : 'Guardar Parámetros SMTP'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE USUARIO */}
        {usuarioAEliminar && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Confirmar eliminación de usuario
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Esta acción es irreversible y revocará sus permisos.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                <div>
                  <strong>Nombre:</strong> {usuarioAEliminar.nombre}
                </div>
                <div>
                  <strong>Cargo:</strong> {usuarioAEliminar.cargo}
                </div>
                <div>
                  <strong>Usuario:</strong> {usuarioAEliminar.usuario}
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente a este usuario del directorio oficial?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUsuarioAEliminar(null)}
                  disabled={cargando}
                  className="py-1.5 px-4 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarEliminacion}
                  disabled={cargando}
                  className="py-1.5 px-4 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {cargando ? 'Eliminando...' : 'Sí, eliminar usuario'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PIE DEL MODAL */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>NotiProfes Digital · Canal Oficial Docente, Directivo y Administrativo · I.E. Villa Flora</span>
          <button
            type="button"
            onClick={onCerrar}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
