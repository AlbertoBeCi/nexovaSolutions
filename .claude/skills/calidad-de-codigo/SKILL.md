---
name: calidad-de-codigo
description: Estandares de calidad de codigo del proyecto (nombres, funciones puras, comentarios, casos vacios, inmutabilidad, formato). Usar al generar o revisar codigo en este repositorio.
---

# Calidad de Código

Sigue estrictamente las siguientes directrices al generar o revisar código:

- **Nombres descriptivos:** Usa nombres descriptivos para variables, funciones e interfaces (`camelCase` para variables y funciones, `PascalCase` para interfaces).
- **Funciones puras:** Cada función debe ser pura: trabaja solo con lo que recibe por parámetros, sin modificar variables globales.
- **Comentarios:** Escribe comentarios solo cuando sea necesario para explicar lógica compleja, no para describir código obvio.
- **Manejo de casos vacíos:** Maneja correctamente casos vacíos (arrays vacíos, elementos no encontrados, valores nulos).
- **Inmutabilidad por defecto:** Usa `const` por defecto y `let` solo cuando el valor vaya a cambiar.
- **Formato:** Mantén la indentación y el formato consistentes en todo el código.
