import pandas as pd

# Leer el CSV
df = pd.read_csv('ejemplo_importacion.csv')

# Guardar como Excel
df.to_excel('ejemplo_importacion.xlsx', index=False)
print("Archivo Excel creado exitosamente!") 