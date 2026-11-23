"""Ejecuta todas las funciones test_* sin pytest: python tests/ejecutar.py."""
import runpy
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
correctas, fallos = 0, []
for archivo in sorted(Path(__file__).parent.glob('test_*.py')):
    try:
        pruebas = runpy.run_path(str(archivo))
    except Exception:
        traceback.print_exc()
        fallos.append(archivo.name)
        continue
    for nombre, funcion in pruebas.items():
        if nombre.startswith('test_') and callable(funcion):
            try:
                funcion()
                correctas += 1
            except Exception:
                traceback.print_exc()
                fallos.append(f'{archivo.name}:{nombre}')
print(f'{correctas} pruebas correctas; {len(fallos)} fallos: {fallos}')
sys.exit(bool(fallos))
