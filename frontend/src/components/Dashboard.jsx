import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from 'recharts';

const COLORES = {
  ingresos: '#ff0000',    // Rojo
  basicos: '#cc0000',     // Rojo oscuro
  deseo: '#ff3333',       // Rojo claro
  otros: '#ff0000',       // Rojo
  aumento: '#ff0000',     // Rojo
  disminucion: '#cc0000', // Rojo oscuro
  total: '#ffffff',       // Blanco
  graficos: ['#ff0000', '#cc0000', '#ff3333', '#ff0000', '#cc0000']
};

function formatCurrency(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0
  }).format(value || 0);
}

function getMonthString(mes) {
  if (!mes) return '';
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const [year, month] = mes.split('-');
  return `${meses[parseInt(month, 10) - 1]} ${year}`;
}

export default function Dashboard() {
  const [resumen, setResumen] = useState([]);
  const [datos, setDatos] = useState([]);
  const [parametros, setParametros] = useState({ categorias: [], subcategorias: {} });
  const [meses, setMeses] = useState([]);
  const [mesSeleccionado, setMesSeleccionado] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('http://localhost:5000/api/resumen-mensual').then(res => res.json()),
      fetch('http://localhost:5000/api/datos').then(res => res.json()),
      fetch('http://localhost:5000/api/parametros').then(res => res.json())
    ]).then(([dataResumen, dataDatos, dataParametros]) => {
      setResumen(dataResumen);
      setDatos(dataDatos);
      setParametros(dataParametros);
      const mesesUnicos = dataResumen.filter(r => r.mes).map(r => r.mes);
      setMeses(mesesUnicos);
      setMesSeleccionado(mesesUnicos[0] || '');
      setLoading(false);
    });
  }, []);

  // Función para normalizar cadenas (quita tildes, pasa a minúsculas y quita espacios)
  const normalizar = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  // Filtrar registros por mes seleccionado
  const registrosMes = datos.filter(r => {
    if (!r.fecha || !mesSeleccionado) return false;
    const [anio, mes] = r.fecha.split(/[-/]/);
    return `${anio}-${mes.padStart(2, '0')}` === mesSeleccionado;
  });

  // Agrupar ingresos (Ingresos y Ahorros)
  const ingresos = registrosMes.filter(r => {
    const cat = normalizar(r.categoria);
    return cat === 'ingresos' || cat === 'ahorros';
  });
  const ingresosPorSubcat = {};
  ingresos.forEach(r => {
    const subcat = (r.subcategoria || 'Sin subcategoría').trim();
    if (!ingresosPorSubcat[subcat]) ingresosPorSubcat[subcat] = 0;
    ingresosPorSubcat[subcat] += parseFloat(r.monto);
  });
  const resumenIngresos = Object.entries(ingresosPorSubcat).map(([subcat, monto]) => ({ subcategoria: subcat, monto }));

  // Agrupar egresos (Gastos básicos y Gastos deseo)
  const egresos = registrosMes.filter(r => {
    const cat = normalizar(r.categoria);
    return cat === 'gastos basicos' || cat === 'gastos deseo';
  });
  const egresosPorSubcat = {};
  egresos.forEach(r => {
    const subcat = (r.subcategoria || 'Sin subcategoría').trim();
    if (!egresosPorSubcat[subcat]) egresosPorSubcat[subcat] = 0;
    egresosPorSubcat[subcat] += parseFloat(r.monto);
  });
  const resumenEgresos = Object.entries(egresosPorSubcat).map(([subcat, monto]) => ({ subcategoria: subcat, monto }));

  // Para gráfico de área: ingresos vs egresos
  const datosMes = resumen.find(r => r.mes === mesSeleccionado) || {};
  const areaData = [
    {
      name: getMonthString(mesSeleccionado),
      Ingresos: datosMes.ingresos || 0,
      Egresos: (datosMes.gastos_basicos || 0) + (datosMes.gastos_deseo || 0)
    }
  ];

  // Gráfico de cascada (waterfall)
  // Sueldo, Otros, Gastos básicos (por subcat), Gastos deseo (por subcat), Ahorros, Total
  let waterfallData = [];
  let acumulado = 0;
  // Ingresos
  Object.entries(ingresosPorSubcat).forEach(([subcat, monto]) => {
    waterfallData.push({
      name: subcat,
      value: monto,
      tipo: 'aumento',
      acumulado: acumulado + monto
    });
    acumulado += monto;
  });
  // Egresos (negativos)
  Object.entries(egresosPorSubcat).forEach(([subcat, monto]) => {
    waterfallData.push({
      name: subcat,
      value: -monto,
      tipo: 'disminucion',
      acumulado: acumulado - monto
    });
    acumulado -= monto;
  });
  // Ahorros (si existen)
  const ahorro = ingresosPorSubcat['Ahorro'] || 0;
  if (ahorro) {
    waterfallData.push({
      name: 'Ahorro',
      value: ahorro,
      tipo: 'aumento',
      acumulado: acumulado + ahorro
    });
    acumulado += ahorro;
  }
  // Total
  waterfallData.push({
    name: 'TOTAL',
    value: acumulado,
    tipo: 'total',
    acumulado
  });

  if (loading) return <div className="cargando">Cargando dashboard...</div>;

  return (
    <div className="dashboard-container" style={{ padding: '20px' }}>
      {/* Gráfico de cascada */}
      <div style={{ marginBottom: 32, background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 60, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12, fill: 'var(--text-color)' }}
            />
            <YAxis 
              tickFormatter={formatCurrency} 
              tick={{ fontSize: 12, fill: 'var(--text-color)' }}
              width={100}
            />
            <Tooltip 
              formatter={formatCurrency}
              contentStyle={{ 
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)'
              }}
            />
            <Bar dataKey="value">
              {waterfallData.map((entry, index) => (
                <Cell key={index} fill={
                  entry.tipo === 'aumento' ? COLORES.aumento :
                  entry.tipo === 'disminucion' ? COLORES.disminucion :
                  COLORES.total
                } />
              ))}
              <LabelList 
                dataKey="value" 
                position="top" 
                formatter={formatCurrency}
                style={{ fontSize: '14px', fontWeight: 600, fill: 'var(--text-color)' }} 
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 14, justifyContent: 'center' }}>
          <div style={{ color: COLORES.aumento, fontWeight: 700 }}>■ Aumento</div>
          <div style={{ color: COLORES.disminucion, fontWeight: 700 }}>■ Disminución</div>
          <div style={{ color: COLORES.total, fontWeight: 700 }}>■ Total</div>
        </div>
      </div>

      {/* Selector de mes y acciones */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 24, 
        background: 'var(--surface-color)', 
        padding: '20px', 
        borderRadius: '12px',
        boxShadow: 'var(--shadow)',
        marginBottom: 32
      }}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-light)', fontSize: 18 }}>SELECCIONA EL MES:</div>
          <select
            value={mesSeleccionado}
            onChange={e => setMesSeleccionado(e.target.value)}
            className="selector-mes"
          >
            {meses.map(m => (
              <option key={m} value={m}>{getMonthString(m)}</option>
            ))}
          </select>
        </div>
        <div style={{ fontWeight: 700, fontSize: 24, marginLeft: 'auto' }}>
          SALDO <span style={{ color: datosMes.saldo > 0 ? COLORES.ingresos : COLORES.deseo, marginLeft: 8 }}>{formatCurrency(datosMes.saldo)}</span>
        </div>
      </div>

      {/* Resúmenes */}
      <div style={{ display: 'flex', gap: 24, marginTop: 32 }}>
        <div style={{ flex: 1, background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: 18, marginBottom: 16, textAlign: 'center' }}>
            RESUMEN DE INGRESOS Y AHORROS
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--primary-color)' }}>
                <th style={{ padding: '12px 16px', color: '#fff', textAlign: 'left', borderRadius: '8px 0 0 0' }}>SUBCATEGORÍA</th>
                <th style={{ padding: '12px 16px', color: '#fff', textAlign: 'right', borderRadius: '0 8px 0 0' }}>MONTO</th>
              </tr>
            </thead>
            <tbody>
              {resumenIngresos.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.subcategoria}</td>
                  <td style={{ padding: '12px 16px', color: COLORES.ingresos, fontWeight: 600, textAlign: 'right' }}>
                    {formatCurrency(r.monto)}
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--background-color)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: '12px 16px', color: COLORES.ingresos, fontWeight: 700, textAlign: 'right' }}>
                  {formatCurrency(resumenIngresos.reduce((a,b)=>a+b.monto,0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: 18, marginBottom: 16, textAlign: 'center' }}>
            RESUMEN DE EGRESOS (BÁSICOS Y DESEO)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--primary-dark)' }}>
                <th style={{ padding: '12px 16px', color: '#fff', textAlign: 'left', borderRadius: '8px 0 0 0' }}>SUBCATEGORÍA</th>
                <th style={{ padding: '12px 16px', color: '#fff', textAlign: 'right', borderRadius: '0 8px 0 0' }}>MONTO</th>
              </tr>
            </thead>
            <tbody>
              {resumenEgresos.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.subcategoria}</td>
                  <td style={{ padding: '12px 16px', color: COLORES.basicos, fontWeight: 600, textAlign: 'right' }}>
                    {formatCurrency(r.monto)}
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--background-color)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: '12px 16px', color: COLORES.deseo, fontWeight: 700, textAlign: 'right' }}>
                  {formatCurrency(resumenEgresos.reduce((a,b)=>a+b.monto,0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficos */}
      <div style={{ display: 'flex', gap: 32, marginTop: 32 }}>
        <div style={{ flex: 1, background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: 18, marginBottom: 16, textAlign: 'center' }}>
            EGRESOS POR SUBCATEGORÍA
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={resumenEgresos} margin={{ top: 20, right: 30, left: 60, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis 
                dataKey="subcategoria" 
                tick={{ fontSize: 12, fill: 'var(--text-color)' }}
              />
              <YAxis 
                tickFormatter={formatCurrency} 
                tick={{ fontSize: 12, fill: 'var(--text-color)' }}
                width={100}
              />
              <Tooltip 
                formatter={formatCurrency}
                contentStyle={{ 
                  background: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-color)'
                }}
              />
              <Bar dataKey="monto" fill={COLORES.basicos}>
                <LabelList 
                  dataKey="monto" 
                  position="top" 
                  formatter={formatCurrency}
                  style={{ fontSize: '12px', fill: 'var(--text-color)' }} 
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: 18, marginBottom: 16, textAlign: 'center' }}>
            INGRESOS VS EGRESOS
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={areaData} margin={{ top: 20, right: 30, left: 60, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12, fill: 'var(--text-color)' }}
              />
              <YAxis 
                tickFormatter={formatCurrency} 
                tick={{ fontSize: 12, fill: 'var(--text-color)' }}
                width={100}
              />
              <Tooltip 
                formatter={formatCurrency}
                contentStyle={{ 
                  background: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-color)'
                }}
              />
              <Bar dataKey="Ingresos" fill={COLORES.ingresos}>
                <LabelList 
                  dataKey="Ingresos" 
                  position="top" 
                  formatter={formatCurrency}
                  style={{ fontSize: '12px', fill: 'var(--text-color)' }} 
                />
              </Bar>
              <Bar dataKey="Egresos" fill={COLORES.deseo}>
                <LabelList 
                  dataKey="Egresos" 
                  position="top" 
                  formatter={formatCurrency}
                  style={{ fontSize: '12px', fill: 'var(--text-color)' }} 
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
