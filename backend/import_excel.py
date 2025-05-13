import pandas as pd
import sqlite3
import os
from datetime import datetime

# Ruta a la base de datos
DB_PATH = os.path.join(os.path.dirname(__file__), 'datos.db')

def inicializar_db():
    """Inicializa la base de datos creando la tabla si no existe."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Crear tabla de registros
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS datos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha DATE NOT NULL,
            tipo TEXT NOT NULL,
            categoria TEXT NOT NULL,
            subcategoria TEXT NOT NULL,
            metodoPago TEXT NOT NULL,
            monto REAL NOT NULL,
            detalle TEXT,
            cuotas INTEGER DEFAULT 1
        )
    ''')
    
    # Crear índices para mejorar el rendimiento
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_fecha ON datos(fecha)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tipo ON datos(tipo)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_categoria ON datos(categoria)')
    
    conn.commit()
    conn.close()
    print("Base de datos inicializada correctamente")

def validar_datos(df):
    """Valida que el DataFrame tenga las columnas requeridas y los datos sean válidos."""
    columnas_requeridas = ['fecha', 'tipo', 'categoria', 'subcategoria', 'metodoPago', 'monto']
    
    # Verificar columnas requeridas
    columnas_faltantes = [col for col in columnas_requeridas if col not in df.columns]
    if columnas_faltantes:
        raise ValueError(f"Faltan las siguientes columnas en el Excel: {', '.join(columnas_faltantes)}")
    
    # Validar tipos de datos
    df['fecha'] = pd.to_datetime(df['fecha']).dt.strftime('%Y-%m-%d')
    df['monto'] = pd.to_numeric(df['monto'], errors='coerce')
    
    # Validar valores no nulos
    for col in columnas_requeridas:
        if df[col].isnull().any():
            raise ValueError(f"La columna {col} contiene valores nulos")
    
    # Validar tipos de transacción
    tipos_validos = ['Ingreso', 'Egreso']
    if not df['tipo'].isin(tipos_validos).all():
        raise ValueError(f"La columna 'tipo' debe contener solo: {', '.join(tipos_validos)}")
    
    # Validar montos positivos
    if (df['monto'] <= 0).any():
        raise ValueError("Todos los montos deben ser mayores a 0")

def importar_excel(ruta_excel):
    """Importa datos desde un archivo Excel a la base de datos."""
    try:
        # Inicializar la base de datos primero
        print("Inicializando base de datos...")
        inicializar_db()
        
        # Leer el archivo Excel
        print(f"Leyendo archivo Excel: {ruta_excel}")
        df = pd.read_excel(ruta_excel)
        
        # Validar datos
        print("Validando datos...")
        validar_datos(df)
        
        # Conectar a la base de datos
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Insertar datos
        print("Insertando datos en la base de datos...")
        registros_insertados = 0
        for _, row in df.iterrows():
            cursor.execute('''
                INSERT INTO datos 
                (fecha, tipo, categoria, subcategoria, metodoPago, monto, detalle, cuotas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                row['fecha'],
                row['tipo'],
                row['categoria'],
                row['subcategoria'],
                row['metodoPago'],
                float(row['monto']),
                row.get('detalle', ''),
                int(row.get('cuotas', 1))
            ))
            registros_insertados += 1
        
        # Guardar cambios
        conn.commit()
        print(f"¡Importación exitosa! Se importaron {registros_insertados} registros.")
        
    except Exception as e:
        print(f"Error durante la importación: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
        raise
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) != 2:
        print("Uso: python import_excel.py <ruta_al_archivo_excel>")
        sys.exit(1)
    
    ruta_excel = sys.argv[1]
    if not os.path.exists(ruta_excel):
        print(f"Error: El archivo {ruta_excel} no existe")
        sys.exit(1)
    
    try:
        importar_excel(ruta_excel)
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1) 