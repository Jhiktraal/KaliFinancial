import React, { useState, useEffect } from 'react';

const ResumenMensual = () => {
    const [resumen, setResumen] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    const [mesSeleccionado, setMesSeleccionado] = useState('');
    const [meses, setMeses] = useState([]);
    const [subcatIngresos, setSubcatIngresos] = useState([]);
    const [subcatEgresos, setSubcatEgresos] = useState([]);
    const [loadingSubcats, setLoadingSubcats] = useState(false);

    useEffect(() => {
        const cargarResumen = async () => {
            try {
                const respuesta = await fetch('http://localhost:5000/api/resumen-mensual');
                if (!respuesta.ok) throw new Error('Error al cargar datos');
                const datos = await respuesta.json();
                
                // Ordenar datos: mes más reciente primero
                const datosOrdenados = datos.sort((a, b) => {
                    if (a.mes === '') return 1;
                    if (b.mes === '') return -1;
                    return b.mes.localeCompare(a.mes);
                });
                
                setResumen(datosOrdenados);
                // Extraer meses únicos
                const mesesUnicos = datosOrdenados.filter(r => r.mes).map(r => r.mes);
                setMeses(mesesUnicos);
                setMesSeleccionado(mesesUnicos[0] || '');
            } catch (err) {
                setError(err.message);
            } finally {
                setCargando(false);
            }
        };
        cargarResumen();
    }, []);

    useEffect(() => {
        if (!mesSeleccionado) return;
        setLoadingSubcats(true);
        Promise.all([
            fetch(`http://localhost:5000/api/resumen-subcategorias-ingresos?mes=${mesSeleccionado}`).then(r => r.json()),
            fetch(`http://localhost:5000/api/resumen-subcategorias-egresos?mes=${mesSeleccionado}`).then(r => r.json())
        ]).then(([ing, egr]) => {
            setSubcatIngresos(ing);
            setSubcatEgresos(egr);
        }).finally(() => setLoadingSubcats(false));
    }, [mesSeleccionado]);

    const formatoMoneda = (valor) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2
        }).format(valor || 0);
    };

    const obtenerNombreMes = (mesNumero) => {
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return meses[parseInt(mesNumero) - 1] || '';
    };

    if (cargando) return <div className="cargando">Cargando...</div>;
    if (error) return <div className="error">Error: {error}</div>;

    return (
        <div className="contenedor-resumen">
            <h2 className="titulo-seccion">Resumen Mensual</h2>
            
            {/* Selector de mes */}
            <div style={{ marginBottom: 24 }}>
                <label style={{ fontWeight: 600, color: 'var(--text-light)', marginRight: 12 }}>Selecciona el mes:</label>
                <select
                    value={mesSeleccionado}
                    onChange={e => setMesSeleccionado(e.target.value)}
                    className="selector-mes"
                >
                    {meses.map(m => (
                        <option key={m} value={m}>
                            {obtenerNombreMes(m.split('-')[1])} {m.split('-')[0]}
                        </option>
                    ))}
                </select>
            </div>
            
            <div className="tabla-contenedor">
                <table className="tabla">
                    <thead>
                        <tr>
                            <th rowSpan="2">Año</th>
                            <th rowSpan="2">Mes</th>
                            <th rowSpan="2">Ingresos</th>
                            <th colSpan="3">Presupuesto</th>
                            <th colSpan="6">Realidad</th>
                            <th rowSpan="2">Saldo</th>
                        </tr>
                        <tr>
                            <th>Básicos</th>
                            <th>Deseo</th>
                            <th>Ahorro</th>
                            <th>Básicos ($)</th>
                            <th>%</th>
                            <th>Deseo ($)</th>
                            <th>%</th>
                            <th>Ahorro ($)</th>
                            <th>%</th>
                        </tr>
                    </thead>
                    
                    <tbody>
                        {resumen.map((item, index) => {
                            // Calcular montos reales basados en porcentajes y presupuesto
                            const montoBasicos = (item.real_basicos / 100) * item.presupuesto_basicos;
                            const montoDeseo = (item.real_deseo / 100) * item.presupuesto_deseo;
                            const montoAhorro = (item.real_ahorros / 100) * item.presupuesto_ahorros;
                            
                            return (
                                <tr key={index} className={index % 2 === 0 ? 'fila-par' : 'fila-impar'}>
                                    <td>{item.año || item.mes?.split('-')[0]}</td>
                                    <td>{item.mes ? `${obtenerNombreMes(item.mes.split('-')[1])} ${item.mes.split('-')[0]}` : 'Total'}</td>
                                    <td>{formatoMoneda(item.ingresos)}</td>
                                    <td>{formatoMoneda(item.presupuesto_basicos)}</td>
                                    <td>{formatoMoneda(item.presupuesto_deseo)}</td>
                                    <td>{formatoMoneda(item.presupuesto_ahorros)}</td>
                                    <td>{formatoMoneda(montoBasicos)}</td>
                                    <td>{item.real_basicos?.toFixed(2)}%</td>
                                    <td>{formatoMoneda(montoDeseo)}</td>
                                    <td>{item.real_deseo?.toFixed(2)}%</td>
                                    <td>{formatoMoneda(montoAhorro)}</td>
                                    <td>{item.real_ahorros?.toFixed(2)}%</td>
                                    <td className={`${item.saldo_simbolo === '↑' ? 'positivo' : 'negativo'}`}>
                                        {item.saldo_simbolo} {formatoMoneda(item.saldo)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Listados de subcategorías */}
            <div style={{ display: 'flex', gap: 24, marginTop: 32, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow)', minWidth: 320 }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: 18, marginBottom: 16, textAlign: 'center' }}>
                        RESUMEN DE INGRESOS Y AHORROS
                    </div>
                    {loadingSubcats ? <div className="cargando">Cargando...</div> : (
                        <table className="tabla-estilizada" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left' }}>Subcategoría</th>
                                    <th style={{ textAlign: 'right' }}>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subcatIngresos.map((r, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>{r.subcategoria}</td>
                                        <td style={{ color: 'var(--primary-color)', fontWeight: 600, textAlign: 'right' }}>{formatoMoneda(r.total)}</td>
                                    </tr>
                                ))}
                                <tr style={{ background: 'var(--background-color)' }}>
                                    <td style={{ fontWeight: 700 }}>TOTAL</td>
                                    <td style={{ color: 'var(--primary-color)', fontWeight: 700, textAlign: 'right' }}>{formatoMoneda(subcatIngresos.reduce((a, b) => a + (parseFloat(b.total) || 0), 0))}</td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                </div>
                <div style={{ flex: 1, background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow)', minWidth: 320 }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary-dark)', fontSize: 18, marginBottom: 16, textAlign: 'center' }}>
                        RESUMEN DE EGRESOS (BÁSICOS Y DESEO)
                    </div>
                    {loadingSubcats ? <div className="cargando">Cargando...</div> : (
                        <table className="tabla-estilizada" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left' }}>Subcategoría</th>
                                    <th style={{ textAlign: 'right' }}>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subcatEgresos.map((r, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>{r.subcategoria}</td>
                                        <td style={{ color: 'var(--primary-dark)', fontWeight: 600, textAlign: 'right' }}>{formatoMoneda(r.total)}</td>
                                    </tr>
                                ))}
                                <tr style={{ background: 'var(--background-color)' }}>
                                    <td style={{ fontWeight: 700 }}>TOTAL</td>
                                    <td style={{ color: 'var(--primary-dark)', fontWeight: 700, textAlign: 'right' }}>{formatoMoneda(subcatEgresos.reduce((a, b) => a + (parseFloat(b.total) || 0), 0))}</td>
                                </tr>
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResumenMensual;