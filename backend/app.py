from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import sqlite3
import pandas as pd
from io import BytesIO
 # from reportlab.pdfgen import canvas
from datetime import datetime
from dateutil.relativedelta import relativedelta
import os

app = Flask(__name__)
# Configurar CORS para permitir específicamente el origen del frontend
CORS(app, resources={
    r"/api/*": {
        "origins": "http://localhost:3000",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Ruta relativa a la base de datos
db_path = os.path.join(os.path.dirname(__file__), 'datos.db')

def inicializar_db():
    """Inicializa la base de datos creando la tabla si no existe."""
    conn = None
    try:
        print(f"Inicializando base de datos en: {db_path}")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verificar si la tabla existe
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='datos'")
        if not cursor.fetchone():
            print("Creando tabla datos...")
            # Crear tabla de datos
            cursor.execute('''
                CREATE TABLE datos (
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
            print("Creando índices...")
            cursor.execute('CREATE INDEX idx_fecha ON datos(fecha)')
            cursor.execute('CREATE INDEX idx_tipo ON datos(tipo)')
            cursor.execute('CREATE INDEX idx_categoria ON datos(categoria)')
            
            conn.commit()
            print("Base de datos inicializada correctamente")
        else:
            print("La tabla datos ya existe")
            
    except Exception as e:
        print(f"Error al inicializar la base de datos: {str(e)}")
        if conn:
            conn.rollback()
        raise

# Inicializar la base de datos al arrancar la aplicación
inicializar_db()

def get_db_connection():
    """Obtiene una conexión a la base de datos."""
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        
        # Crear la tabla si no existe
        cursor = conn.cursor()
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
        
        # Crear índices si no existen
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_fecha ON datos(fecha)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_tipo ON datos(tipo)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_categoria ON datos(categoria)')
        
        conn.commit()
        return conn
    except Exception as e:
        print(f"Error al conectar a la base de datos: {str(e)}")
        if conn:
            conn.rollback()
        raise

PARAMETROS = {
    'tipos': ['Ingreso', 'Egreso'],
    'categorias': ['Gastos basicos', 'Gastos deseo', 'Inversiones', 'Ahorros', 'Ingresos'],
    'cuentas': ['Tarjeta de Credito', 'Mercado Pago', 'Cuenta Debito - Tarjeta', 'Cuenta Debito - Transferencia'],
    'subcategorias': {
        'Gastos basicos': ['Supermercado', 'Servicios', 'Transporte', 'Salud', 'Educacion', 'Vivienda'],
        'Gastos deseo': ['Entretenimiento', 'Delivery', 'Ropa', 'Deuda', 'Otros'],
        'Inversiones': ['Acciones', 'Bonos', 'Crypto', 'Otros'],
        'Ahorros': ['Cuenta', 'Plazo Fijo', 'Otros'],
        'Ingresos': ['Sueldo Empresa', 'Ingresos Propios', 'Otros']
    }
}

def normalizar_texto(texto):
    """Normaliza el texto para manejar problemas de codificación y acentos."""
    if not texto:
        return texto
    
    # Mapeo de caracteres acentuados a no acentuados
    mapeo = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'ñ': 'n', 'ü': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'Ñ': 'N', 'Ü': 'U',
        'Ã¡': 'a', 'Ã©': 'e', 'Ã­': 'i', 'Ã³': 'o', 'Ãº': 'u',
        'Ã±': 'n', 'Ã¼': 'u',
        'Ã': 'A', 'Ã': 'E', 'Ã': 'I', 'Ã': 'O', 'Ã': 'U',
        'Ã': 'N', 'Ã': 'U',
        'â€"': '-', 'â€"': '-'
    }
    
    texto_normalizado = texto
    for problema, solucion in mapeo.items():
        texto_normalizado = texto_normalizado.replace(problema, solucion)
    
    return texto_normalizado

@app.route('/api/parametros', methods=['GET'])
def get_parametros():
    return jsonify(PARAMETROS)

@app.route('/api/resumen-mensual', methods=['GET'])
def resumen_mensual():
    conn = get_db_connection()
    try:
        resumen = conn.execute('''
            SELECT 
                strftime("%Y", fecha) AS "año",
                strftime("%m", fecha) AS mes_numero,
                strftime("%Y-%m", fecha) AS mes,
                ROUND(SUM(CASE WHEN tipo = 'Ingreso' THEN monto ELSE 0 END), 2) AS ingresos,
                ROUND(SUM(CASE WHEN tipo = 'Egreso' THEN monto ELSE 0 END), 2) AS egresos,
                ROUND(SUM(CASE WHEN categoria = 'Gastos basicos' THEN monto ELSE 0 END), 2) AS gastos_basicos,
                ROUND(SUM(CASE WHEN categoria = 'Gastos deseo' THEN monto ELSE 0 END), 2) AS gastos_deseo,
                ROUND(SUM(CASE WHEN categoria IN ('Ahorros', 'Inversiones') THEN monto ELSE 0 END), 2) AS ahorros
            FROM datos
            GROUP BY mes
            ORDER BY mes DESC
        ''').fetchall()

        datos_procesados = []
        totales = {'ingresos': 0.0, 'gastos_basicos': 0.0, 'gastos_deseo': 0.0, 'ahorros': 0.0, 'egresos': 0.0}

        for item in resumen:
            item_dict = dict(item)
            ingresos = float(item_dict.get('ingresos', 0)) or 0.0
            egresos = float(item_dict.get('egresos', 0)) or 0.0
            
            item_dict['presupuesto_basicos'] = round(ingresos * 0.6, 2)
            item_dict['presupuesto_deseo'] = round(ingresos * 0.3, 2)
            item_dict['presupuesto_ahorros'] = round(ingresos * 0.1, 2)
            
            item_dict['real_basicos'] = round((item_dict['gastos_basicos'] / ingresos * 100), 2) if ingresos != 0 else 0.0
            item_dict['real_deseo'] = round((item_dict['gastos_deseo'] / ingresos * 100), 2) if ingresos != 0 else 0.0
            item_dict['real_ahorros'] = round((item_dict['ahorros'] / ingresos * 100), 2) if ingresos != 0 else 0.0
            
            saldo = ingresos - egresos
            item_dict['saldo'] = round(saldo, 2)
            item_dict['saldo_simbolo'] = '↑' if saldo > 0 else '↓' if saldo < 0 else '='

            datos_procesados.append(item_dict)
            
            totales['ingresos'] += ingresos
            totales['gastos_basicos'] += item_dict['gastos_basicos']
            totales['gastos_deseo'] += item_dict['gastos_deseo']
            totales['ahorros'] += item_dict['ahorros']
            totales['egresos'] += egresos

        total_row = {
            'año': 'Total',
            'mes': '',
            'ingresos': round(totales['ingresos'], 2),
            'presupuesto_basicos': round(totales['ingresos'] * 0.6, 2),
            'presupuesto_deseo': round(totales['ingresos'] * 0.3, 2),
            'presupuesto_ahorros': round(totales['ingresos'] * 0.1, 2),
            'real_basicos': round((totales['gastos_basicos'] / totales['ingresos'] * 100), 2) if totales['ingresos'] != 0 else 0.0,
            'real_deseo': round((totales['gastos_deseo'] / totales['ingresos'] * 100), 2) if totales['ingresos'] != 0 else 0.0,
            'real_ahorros': round((totales['ahorros'] / totales['ingresos'] * 100), 2) if totales['ingresos'] != 0 else 0.0,
            'saldo': round(totales['ingresos'] - totales['egresos'], 2),
            'saldo_simbolo': '↑' if (totales['ingresos'] - totales['egresos']) > 0 else '↓'
        }
        datos_procesados.append(total_row)

        return jsonify(datos_procesados)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/registros-filtrados', methods=['GET'])
def registros_filtrados():
    fecha_inicio = request.args.get('fecha_inicio')
    fecha_fin = request.args.get('fecha_fin')
    
    conn = get_db_connection()
    try:
        query = '''
            SELECT * FROM datos
            WHERE fecha BETWEEN ? AND ?
            ORDER BY fecha DESC
        '''
        registros = conn.execute(query, (fecha_inicio, fecha_fin)).fetchall()
        return jsonify([dict(row) for row in registros])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/detalle-movimientos')
def detalle_movimientos():
    mes = request.args.get('mes')
    tipo = request.args.get('tipo')
    conn = get_db_connection()
    try:
        query = '''
            SELECT 
                categoria,
                subcategoria,
                SUM(monto) as total
            FROM datos
            WHERE tipo = ? AND strftime("%Y-%m", fecha) = ?
            GROUP BY categoria, subcategoria
        '''
        datos = conn.execute(query, (tipo, mes)).fetchall()
        
        resultado = []
        categorias = {item['categoria'] for item in datos}
        for cat in categorias:
            subcats = [{'nombre': item['subcategoria'], 'total': item['total']} for item in datos if item['categoria'] == cat]
            resultado.append({'categoria': cat, 'subcategorias': subcats})
            
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/datos', methods=['GET', 'POST'])
def manejar_datos():
    conn = get_db_connection()
    if request.method == 'GET':
        registros = conn.execute('SELECT * FROM datos ORDER BY fecha DESC').fetchall()
        return jsonify([dict(row) for row in registros])
    
    elif request.method == 'POST':
        data = request.get_json()
        try:
            cuotas = int(data.get('cuotas', 1))
            if cuotas < 1 or cuotas > 36:
                return jsonify({'error': 'Número de cuotas inválido (1-36)'}), 400
            
            monto_total = float(data['monto'])
            monto_por_cuota = monto_total / cuotas
            fecha_base = datetime.strptime(data['fecha'], '%Y-%m-%d').date()
            detalle_base = data['detalle']

            for i in range(cuotas):
                nueva_fecha = fecha_base + relativedelta(months=i)
                conn.execute('''
                    INSERT INTO datos 
                    (fecha, tipo, categoria, subcategoria, metodoPago, monto, detalle, cuotas)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    nueva_fecha.strftime('%Y-%m-%d'),
                    data['tipo'],
                    data['categoria'],
                    data['subcategoria'],
                    data['metodoPago'],
                    monto_por_cuota,
                    f"{detalle_base} (Cuota {i+1}/{cuotas})",
                    cuotas
                ))
            
            conn.commit()
            return jsonify({'mensaje': f'Registro guardado en {cuotas} cuotas!'}), 201
        
        except Exception as e:
            conn.rollback()
            return jsonify({'error': str(e)}), 500

@app.route('/api/datos/bulk', methods=['POST'])
def importar_datos():
    try:
        print("Recibiendo datos para importación...")
        data = request.get_json()
        print("Datos recibidos:", data)
        
        if not data or not isinstance(data, list):
            print("Error: datos no es una lista")
            return jsonify({'error': 'Datos inválidos: se esperaba una lista de registros'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        
        registros_insertados = 0
        errores = []
        for i, registro in enumerate(data, 1):
            try:
                print(f"\nProcesando registro {i}:", registro)
                
                # Normalizar campos de texto
                registro['categoria'] = normalizar_texto(registro['categoria'])
                registro['subcategoria'] = normalizar_texto(registro['subcategoria'])
                registro['metodoPago'] = normalizar_texto(registro['metodoPago'])
                
                # Validar campos requeridos
                campos_requeridos = ['fecha', 'tipo', 'categoria', 'subcategoria', 'metodoPago', 'monto']
                campos_faltantes = [campo for campo in campos_requeridos if campo not in registro or not registro[campo]]
                if campos_faltantes:
                    raise ValueError(f'Campos requeridos faltantes: {", ".join(campos_faltantes)}')

                # Validar tipo
                if registro['tipo'] not in PARAMETROS['tipos']:
                    raise ValueError(f'Tipo inválido: {registro["tipo"]}. Debe ser uno de: {", ".join(PARAMETROS["tipos"])}')

                # Validar categoría
                if registro['categoria'] not in PARAMETROS['categorias']:
                    raise ValueError(f'Categoría inválida: {registro["categoria"]}. Debe ser una de: {", ".join(PARAMETROS["categorias"])}')

                # Validar subcategoría
                subcategorias_validas = PARAMETROS['subcategorias'].get(registro['categoria'], [])
                if registro['subcategoria'] not in subcategorias_validas:
                    raise ValueError(f'Subcategoría inválida: {registro["subcategoria"]}. Para la categoría {registro["categoria"]}, debe ser una de: {", ".join(subcategorias_validas)}')

                # Validar método de pago
                if registro['metodoPago'] not in PARAMETROS['cuentas']:
                    raise ValueError(f'Método de pago inválido: {registro["metodoPago"]}. Debe ser uno de: {", ".join(PARAMETROS["cuentas"])}')

                # Validar monto
                try:
                    monto = float(registro['monto'])
                    if monto <= 0:
                        raise ValueError('El monto debe ser mayor a 0')
                except ValueError:
                    raise ValueError(f'Monto inválido: {registro["monto"]}. Debe ser un número mayor a 0')

                print(f"Registro {i} válido, insertando en la base de datos...")
                # Insertar registro
                cursor.execute('''
                    INSERT INTO datos 
                    (fecha, tipo, categoria, subcategoria, metodoPago, monto, detalle, cuotas)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    registro['fecha'],
                    registro['tipo'],
                    registro['categoria'],
                    registro['subcategoria'],
                    registro['metodoPago'],
                    monto,
                    registro.get('detalle', ''),
                    registro.get('cuotas', 1)
                ))
                registros_insertados += 1
                print(f"Registro {i} insertado exitosamente")

            except Exception as e:
                error_msg = f'Error en registro {i}: {str(e)}'
                print(error_msg)
                errores.append(error_msg)
                continue

        conn.commit()
        print(f"\nImportación completada. Registros insertados: {registros_insertados}")
        print("Errores encontrados:", errores)
        
        return jsonify({
            'mensaje': f'Se importaron {registros_insertados} registros exitosamente',
            'registros_importados': registros_insertados,
            'errores': errores
        }), 201

    except Exception as e:
        print("Error general:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/datos-dashboard', methods=['GET'])
def datos_dashboard():
    conn = get_db_connection()
    try:
        egresos = conn.execute('''
            SELECT categoria, SUM(monto) as total 
            FROM datos 
            WHERE tipo = 'Egreso'
            GROUP BY categoria
        ''').fetchall()
        
        ingresos = conn.execute('''
            SELECT strftime("%Y-%m", fecha) as mes, SUM(monto) as total
            FROM datos 
            WHERE tipo = 'Ingreso'
            GROUP BY mes
            ORDER BY mes
        ''').fetchall()
        
        return jsonify({
            'egresos': [dict(row) for row in egresos],
            'ingresos': [dict(row) for row in ingresos]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/exportar-excel')
def exportar_excel():
    conn = get_db_connection()
    try:
        df = pd.read_sql_query("SELECT * FROM datos", conn)
        df.to_excel("registro.xlsx", index=False)
        return send_file("registro.xlsx", as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

"""
@app.route('/api/exportar-pdf')
def exportar_pdf():
    conn = get_db_connection()
    try:
        registros = conn.execute('SELECT * FROM datos').fetchall()
        buffer = BytesIO()
        p = canvas.Canvas(buffer)
        p.setFont("Helvetica", 12)
        p.setFillColorRGB(0.07, 0.54, 0.98)
        p.drawString(50, 800, "Reporte de Registros Financieros")
        y = 750
        for registro in registros:
            texto = f"{registro['fecha']} | {registro['categoria']} - {registro['subcategoria']}: ${registro['monto']:.2f}"
            p.drawString(50, y, texto)
            y -= 20
            if y < 50:
                p.showPage()
                y = 800
        p.save()
        buffer.seek(0)
        return send_file(buffer, mimetype='application/pdf', download_name='reporte.pdf')
    except Exception as e:
        return jsonify({'error': str(e)}), 500
"""

@app.route('/api/transacciones', methods=['GET'])
def get_transacciones():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT fecha, clave_cuenta, descripcion, monto, clave_territorio FROM transacciones")
    transacciones = cursor.fetchall()

    data = []
    for row in transacciones:
        data.append({
            "fecha": row[0],
            "clave_cuenta": row[1],
            "descripcion": row[2],
            "monto": row[3],
            "clave_territorio": row[4]
        })
    return jsonify(data)

@app.route('/api/resumen-subcategorias-ingresos', methods=['GET'])
def resumen_subcategorias_ingresos():
    mes = request.args.get('mes')
    if not mes:
        return jsonify({'error': 'Falta el parámetro mes'}), 400
    conn = get_db_connection()
    try:
        query = '''
            SELECT categoria, subcategoria, SUM(monto) as total
            FROM datos
            WHERE strftime('%Y-%m', fecha) = ?
              AND (tipo = 'Ingreso' OR categoria = 'Ahorros')
            GROUP BY categoria, subcategoria
        '''
        datos = conn.execute(query, (mes,)).fetchall()
        resultado = []
        for row in datos:
            resultado.append({
                'categoria': row['categoria'],
                'subcategoria': row['subcategoria'],
                'total': row['total']
            })
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/resumen-subcategorias-egresos', methods=['GET'])
def resumen_subcategorias_egresos():
    mes = request.args.get('mes')
    if not mes:
        return jsonify({'error': 'Falta el parámetro mes'}), 400
    conn = get_db_connection()
    try:
        query = '''
            SELECT categoria, subcategoria, SUM(monto) as total
            FROM datos
            WHERE tipo = 'Egreso' AND categoria IN ('Gastos basicos', 'Gastos deseo')
              AND strftime('%Y-%m', fecha) = ?
            GROUP BY categoria, subcategoria
        '''
        datos = conn.execute(query, (mes,)).fetchall()
        resultado = []
        for row in datos:
            resultado.append({
                'categoria': row['categoria'],
                'subcategoria': row['subcategoria'],
                'total': row['total']
            })
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run()
