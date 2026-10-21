# 🖥️ De la API a una pantalla con React

**Idea principal:** React organiza una pantalla en piezas y la actualiza cuando cambian sus datos.

## 🧩 La página de incidencias

    Elegir CSV → enviar a la API → guardar respuesta → mostrar métricas

| Pieza | Qué hace |
| --- | --- |
| `page.tsx` | Coordina el archivo, la carga, el resultado y los errores. |
| `csv-uploader.tsx` | Recibe el archivo por clic o arrastre. |
| `analysis-summary.tsx` | Muestra las métricas recibidas. |

Los componentes reciben información mediante **props**. Cada pieza tiene una tarea concreta.

## 🔄 El estado: `useState`

```tsx
const [analyzing, setAnalyzing] = useState(false);
```

`analyzing` recuerda si hay un análisis en marcha. Al cambiarlo con `setAnalyzing`, React vuelve a dibujar la pantalla con el estado nuevo.

El resultado y el mensaje de error se guardan de la misma forma.

## 📡 Hablar con el backend

El cliente de incidencias convierte el archivo en **`FormData`** y lo envía a la API. El cliente HTTP compartido adjunta el JWT.

También transforma nombres: `total_records` pasa a `totalRecords` en la interfaz. Así los componentes trabajan con un formato consistente.

Los códigos como `TECHNICAL` se traducen a etiquetas como «Técnico». Los errores se muestran en español y los fallos de carga ofrecen reintentar.

## 📥 Descargar el resumen

La respuesta CSV se convierte en un **`Blob`**, un archivo en memoria. Una URL temporal y un enlace con `download` permiten que el navegador ofrezca guardarlo. La URL se libera al terminar.

El botón de exportación se habilita cuando ya existe un resultado.

📍 [Página](uis/backoffice/src/app/incidencias/page.tsx) · [Cliente HTTP](uis/backoffice/src/services/incidents-api.ts).

🏠 [Volver al índice](APRENDIENDO.md)
