import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function FinancialOverviewDashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:5000/api/transacciones')
      .then(response => {
        setData(response.data);
      })
      .catch(error => {
        console.error('Error al obtener datos:', error);
      });
  }, []);

  return (
    <div style={{ backgroundImage: "url('/Finanzaempresarial.jpg')", backgroundSize: 'cover', minHeight: '100vh', padding: '2rem', color: '#fff' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Dashboard Empresarial</h1>
      {data.length === 0 ? (
        <p>Cargando datos...</p>
      ) : (
        <table style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '12px' }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cuenta</th>
              <th>Descripción</th>
              <th>Monto</th>
              <th>Territorio</th>
            </tr>
          </thead>
          <tbody>
            {data.map((registro, index) => (
              <tr key={index}>
                <td>{registro.fecha}</td>
                <td>{registro.clave_cuenta}</td>
                <td>{registro.descripcion}</td>
                <td>{registro.monto}</td>
                <td>{registro.clave_territorio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}