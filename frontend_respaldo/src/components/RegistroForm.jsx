import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import * as XLSX from 'xlsx';

const API_BASE_URL = 'http://localhost:5000';

function RegistroForm() {
  // Estados del formulario
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'Egreso',
    categoria: '',
    subcategoria: '',
    metodoPago: '',
    monto: '',
    detalle: '',
    cuotas: 1
  });

  // Estados para filtros
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().setDate(1)));
  const [fechaFin, setFechaFin] = useState(new Date());

  // Parámetros y registros
  const [parametros, setParametros] = useState({ tipos: [], cuentas: [], categorias: [], subcategorias: {} });
  const [allDatos, setAllDatos] = useState([]);
  const [registrosFiltrados, setRegistrosFiltrados] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Función para cargar parámetros y registros completos
  const cargarDatosIniciales = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Cargando datos iniciales...');
      
      // Cargar parámetros
      const resParams = await fetch(`${API_BASE_URL}/api/parametros`);
      if (!resParams.ok) {
        throw new Error(`Error al cargar parámetros: ${resParams.statusText}`);
      }
      const datosParams = await resParams.json();
      console.log('Parámetros cargados:', datosParams);

      // Cargar registros
      const resAll = await fetch(`${API_BASE_URL}/api/datos`);
      if (!resAll.ok) {
        throw new Error(`Error al cargar registros: ${resAll.statusText}`);
      }
      const listaRegistros = await resAll.json();
      console.log('Registros cargados:', listaRegistros);

      setParametros({
        tipos: datosParams.tipos || [],
        cuentas: datosParams.cuentas || [],
        categorias: datosParams.categorias || [],
        subcategorias: datosParams.subcategorias || {}
      });
      setAllDatos(listaRegistros);
      setRegistrosFiltrados(listaRegistros); // Mostrar todos los registros inicialmente
      ajustarRangoFechas(listaRegistros); // Ajustar fechas automáticamente
    } catch (err) {
      console.error('Error en cargarDatosIniciales:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Aplica filtro local sobre allDatos
  const aplicarFiltroLocal = () => {
    setError(null);
    if (fechaInicio > fechaFin) {
      setError('La fecha de inicio no puede ser posterior a la fecha fin.');
      setRegistrosFiltrados([]);
      return;
    }
    const inicioMs = fechaInicio.setHours(0,0,0,0);
    const finMs = fechaFin.setHours(23,59,59,999);
    console.log('Aplicando filtro con fechas:', {
      inicio: new Date(inicioMs).toISOString(),
      fin: new Date(finMs).toISOString(),
      totalRegistros: allDatos.length
    });
    
    const filtrados = allDatos.filter(r => {
      const ts = new Date(r.fecha).getTime();
      return ts >= inicioMs && ts <= finMs;
    });
    console.log('Registros filtrados:', filtrados);
    setRegistrosFiltrados(filtrados);
  };

  // Agregar función para encontrar el rango de fechas de los registros
  const ajustarRangoFechas = (registros) => {
    if (!registros || registros.length === 0) return;
    const fechas = registros.map(r => new Date(r.fecha));
    const minFecha = new Date(Math.min(...fechas));
    const maxFecha = new Date(Math.max(...fechas));
    setFechaInicio(minFecha);
    setFechaFin(maxFecha);
  };

  // Carga inicial al montar
  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  // Reaplicar filtro cuando cambian fechas o allDatos
  useEffect(() => {
    aplicarFiltroLocal();
  }, [fechaInicio, fechaFin, allDatos]);

  // Manejador de cambios del formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'cuotas' ? Math.max(1, Math.min(36, parseInt(value,10)||1)) : value
    }));
  };

  // Validación del formulario
  const validarFormulario = () => {
    if (!form.categoria || !form.subcategoria) {
      setError('Seleccionar categoría y subcategoría');
      return false;
    }
    if (isNaN(form.monto) || form.monto === '') {
      setError('Monto inválido');
      return false;
    }
    return true;
  };

  // Enviar registro nuevo
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!validarFormulario()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/datos`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(form)
      });
      
      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(`Error al guardar registro: ${errorData}`);
      }
      
      await refrescarRegistros();
      setForm(prev => ({ ...prev, monto: '', detalle: '', cuotas: 1 }));
    } catch (err) {
      console.error('Error en handleSubmit:', err);
      setError(err.message);
    }
  };

  // Limpiar formulario
  const handleLimpiar = () => {
    setForm({ fecha: new Date().toISOString().split('T')[0], tipo: 'Egreso', categoria: '', subcategoria: '', metodoPago: '', monto: '', detalle: '', cuotas: 1 });
    setError(null);
  };

  // Función para convertir fecha de Excel a YYYY-MM-DD
  const excelDateToJSDate = (excelDate) => {
    // Excel usa días desde el 1 de enero de 1900
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const excelEpoch = new Date(1900, 0, 1);
    const days = excelDate - 1; // Excel tiene un bug donde considera 1900 como año bisiesto
    
    // Ajustar por el bug de Excel con el año bisiesto 1900
    const date = new Date(excelEpoch.getTime() + days * millisecondsPerDay);
    
    // Formatear la fecha como YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  // Función para normalizar texto (quitar acentos y caracteres especiales)
  const normalizarTexto = (texto) => {
    if (!texto) return texto;
    return texto.toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quita acentos
      .replace(/[–—]/g, '-') // Reemplaza guiones especiales
      .trim();
  };

  // Función para manejar la carga de Excel
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('Archivo seleccionado:', file.name);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        console.log('Leyendo archivo Excel...');
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        console.log('Datos leídos del Excel:', jsonData);

        // Validar y transformar datos
        const registrosFormateados = jsonData.map((row, index) => {
          console.log(`Procesando fila ${index + 1}:`, row);
          
          // Convertir fecha de Excel a formato YYYY-MM-DD
          let fecha;
          if (typeof row.fecha === 'number') {
            fecha = excelDateToJSDate(row.fecha);
            console.log(`Fecha convertida de ${row.fecha} a ${fecha}`);
          } else if (row.fecha instanceof Date) {
            const year = row.fecha.getFullYear();
            const month = String(row.fecha.getMonth() + 1).padStart(2, '0');
            const day = String(row.fecha.getDate()).padStart(2, '0');
            fecha = `${year}-${month}-${day}`;
          } else if (typeof row.fecha === 'string') {
            try {
              const date = new Date(row.fecha);
              if (isNaN(date.getTime())) {
                throw new Error('Fecha inválida');
              }
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              fecha = `${year}-${month}-${day}`;
            } catch (e) {
              console.error('Error al convertir fecha:', row.fecha);
              throw new Error(`Error en la fila ${index + 1}: Fecha inválida - ${row.fecha}`);
            }
          } else {
            throw new Error(`Error en la fila ${index + 1}: Fecha inválida - ${row.fecha}`);
          }

          // Validar que todos los campos requeridos estén presentes
          const camposRequeridos = ['tipo', 'categoria', 'subcategoria', 'metodoPago', 'monto'];
          const camposFaltantes = camposRequeridos.filter(campo => !row[campo]);
          if (camposFaltantes.length > 0) {
            throw new Error(`Error en la fila ${index + 1}: Faltan campos requeridos - ${camposFaltantes.join(', ')}`);
          }

          // Validar que el monto sea un número válido
          const monto = parseFloat(row.monto);
          if (isNaN(monto) || monto <= 0) {
            throw new Error(`Error en la fila ${index + 1}: Monto inválido - ${row.monto}`);
          }

          const registro = {
            fecha: fecha,
            tipo: normalizarTexto(row.tipo),
            categoria: normalizarTexto(row.categoria),
            subcategoria: normalizarTexto(row.subcategoria),
            metodoPago: normalizarTexto(row.metodoPago),
            monto: monto,
            detalle: normalizarTexto(row.detalle || ''),
            cuotas: parseInt(row.cuotas || 1)
          };

          console.log(`Fila ${index + 1} formateada:`, registro);
          return registro;
        });

        console.log('Registros formateados:', registrosFormateados);

        const res = await fetch(`${API_BASE_URL}/api/datos/bulk`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(registrosFormateados)
        });

        const responseData = await res.json();
        console.log('Respuesta del servidor:', responseData);

        if (!res.ok) {
          throw new Error(responseData.error || 'Error al importar registros');
        }

        if (responseData.errores && responseData.errores.length > 0) {
          setError(`Se importaron ${responseData.registros_importados} registros, pero hubo errores:\n${responseData.errores.join('\n')}`);
        } else {
          alert(`Registros importados exitosamente: ${responseData.registros_importados}`);
        }
        
        await refrescarRegistros();
      } catch (error) {
        console.error('Error en handleFileUpload:', error);
        setError('Error al importar registros: ' + error.message);
      }
    };
    
    reader.onerror = (error) => {
      console.error('Error al leer el archivo:', error);
      setError('Error al leer el archivo Excel');
    };
    
    reader.readAsArrayBuffer(file);
  };

  // Función para descargar Excel
  const handleDownloadExcel = () => {
    const registrosParaExcel = registrosFiltrados.map(r => ({
      fecha: r.fecha,
      tipo: r.tipo,
      categoria: r.categoria,
      subcategoria: r.subcategoria,
      metodoPago: r.metodoPago,
      monto: r.monto,
      cuotas: r.cuotas,
      detalle: r.detalle
    }));

    const ws = XLSX.utils.json_to_sheet(registrosParaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registros");
    XLSX.writeFile(wb, "registros_financieros.xlsx");
  };

  // Modificar refrescarRegistros para ajustar el rango de fechas
  const refrescarRegistros = async () => {
    const resAll = await fetch(`${API_BASE_URL}/api/datos`);
    const listaRegistros = await resAll.json();
    setAllDatos(listaRegistros);
    ajustarRangoFechas(listaRegistros);
  };

  return (
    <div className="formulario">
      <h2 className="titulo-formulario">Registro Financiero</h2>
      {error && <div className="error">{error}</div>}
      {loading && <div className="cargando">Cargando datos...</div>}

      {/* Sección de filtros */}
      <div className="filtros-section">
        <h3>Filtrar por rango de fechas</h3>
        <div className="controles-fecha">
          <div className="campo-fecha">
            <label>Desde:</label>
            <DatePicker 
              selected={fechaInicio} 
              onChange={setFechaInicio} 
              dateFormat="dd/MM/yyyy" 
              className="input-fecha"
            />
          </div>
          <div className="campo-fecha">
            <label>Hasta:</label>
            <DatePicker 
              selected={fechaFin} 
              onChange={setFechaFin} 
              dateFormat="dd/MM/yyyy" 
              maxDate={new Date()} 
              className="input-fecha"
            />
          </div>
          <button className="btn-filtrar" onClick={aplicarFiltroLocal}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filtrar
          </button>
          <label className="btn-upload">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            📤 Importar Excel
          </label>
          <button className="btn-download" onClick={handleDownloadExcel}>
            📥 Descargar Excel
          </button>
        </div>
      </div>

      <div className="grid-form-registro">
        {/* Formulario de carga */}
        <form onSubmit={handleSubmit} className="formulario-carga">
          <div className="grid-form">
            <div className="campo">
              <label htmlFor="fecha">Fecha:</label>
              <input 
                id="fecha" 
                type="date" 
                name="fecha" 
                value={form.fecha} 
                onChange={handleChange} 
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="tipo">Tipo:</label>
              <select 
                id="tipo" 
                name="tipo" 
                value={form.tipo} 
                onChange={handleChange} 
                required
              >
                <option value="">Seleccione tipo</option>
                {parametros.tipos.map((t,i) => (
                  <option key={i} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="categoria">Categoría:</label>
              <select id="categoria" name="categoria" value={form.categoria} onChange={handleChange} required>
                <option value="">Seleccione categoría</option>
                {parametros.categorias.map((c, i) => (
                  <option key={i} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="subcategoria">Subcategoría:</label>
              <select id="subcategoria" name="subcategoria" value={form.subcategoria} onChange={handleChange} disabled={!form.categoria} required>
                <option value="">Primero seleccione categoría</option>
                {form.categoria && parametros.subcategorias[form.categoria]?.map((s, i) => (
                  <option key={i} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="metodoPago">Método de Pago:</label>
              <select id="metodoPago" name="metodoPago" value={form.metodoPago} onChange={handleChange} required>
                <option value="">Seleccione método</option>
                {parametros.cuentas.map((c, i) => (
                  <option key={i} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="campo"><label htmlFor="monto">Monto ($):</label><input id="monto" type="number" name="monto" value={form.monto} onChange={handleChange} min="0.01" step="0.01" required/></div>
            <div className="campo"><label htmlFor="cuotas">Cuotas:</label><input id="cuotas" type="number" name="cuotas" value={form.cuotas} onChange={handleChange} min="1" max="36" required/></div>
            <div className="campo full-width"><label htmlFor="detalle">Detalle:</label><input id="detalle" type="text" name="detalle" value={form.detalle} onChange={handleChange} placeholder="Descripción detallada del gasto" required/></div>
          </div>
          <div className="botones-formulario">
            <button type="button" onClick={handleLimpiar} className="btn-limpiar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/>
                <path d="M12 19l-7-7 7-7"/>
              </svg>
              Limpiar
            </button>
            <button type="submit" className="btn-guardar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Guardar Registro
            </button>
          </div>
        </form>

        {/* Tabla de registros filtrados */}
        <div className="seccion-registros">
          <div className="contenedor-tabla-estilizada">
            <table className="tabla-estilizada">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Subcategoría</th>
                  <th>Monto</th>
                  <th>Cuotas</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {registrosFiltrados.length > 0 ? (
                  registrosFiltrados.map((r, i) => (
                    <tr key={i} className={`fila-${r.tipo.toLowerCase()}`}>
                      <td>{new Date(r.fecha).toLocaleDateString('es-AR')}</td>
                      <td>{r.tipo}</td>
                      <td>{r.categoria}</td>
                      <td>{r.subcategoria}</td>
                      <td>${parseFloat(r.monto).toFixed(2)}</td>
                      <td>{r.cuotas}</td>
                      <td>{r.detalle}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="sin-registros">
                      No hay registros en el periodo seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegistroForm;