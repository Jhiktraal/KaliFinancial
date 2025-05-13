import sqlite3
import os

# Ruta a la base de datos
DB_PATH = os.path.join(os.path.dirname(__file__), 'datos.db')

def inicializar_db():
    # Eliminar la base de datos existente si existe
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    
    # Crear nueva conexión
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
    
    # Confirmar cambios y cerrar conexión
    conn.commit()
    conn.close()
    
    print("Base de datos inicializada correctamente!")

if __name__ == '__main__':
    inicializar_db() 