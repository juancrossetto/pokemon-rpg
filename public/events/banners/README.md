# Artes del banner destacado del home

Un archivo por **posición** del carrusel. El orden lo define el array `slides`
de `src/components/home/home-event-showcase.tsx`:

| archivo      | posición | slide actual | pantalla  |
| ------------ | -------- | ------------ | --------- |
| `slot-1.png` | 1ª       | `limited`    | `/events` |
| `slot-2.png` | 2ª       | `stones`     | `/events` |
| `slot-3.png` | 3ª       | `tower`      | `/tower`  |

Los nombres son posicionales **a propósito**, y no el `id` del slide. Los artes
rotan y el evento de cada posición no: un arte de gemas guardado como
`tower.png` parece el arte viejo de la torre aunque sea el nuevo, y ya pasó una
vez. La posición no miente.

## Rotar un arte

1. Dejar el archivo nuevo acá **con un nombre distinto** al que reemplaza
   (`slot-3-v2.png`, o directamente el nombre del evento) y actualizar
   `art.src`. Pisar el archivo con el mismo nombre también funciona, pero el
   optimizador de `next/image` cachea por URL: en un server ya corriendo se
   sigue sirviendo el arte viejo hasta reiniciarlo.
2. Ajustar `art.ratio` y `art.focus` de ese slide. **Este paso no es opcional**:
   `ratio` es la proporción de la caja y define cuánto crece el sujeto;
   `focus` elige qué se recorta. Un arte nuevo con los valores del anterior
   suele quedar con el sujeto cortado — medir en el navegador, no estimar.

## Qué arte funciona

- **Mínimo 1200 px de ancho.** Es el requisito que más se pasa por alto. La
  caja del arte mide ~600px CSS en escritorio, y una pantalla 2x —cualquier
  portátil moderno— pide el doble de píxeles físicos. `next/image` **nunca
  agranda** por encima del original: si el archivo tiene 400px, se ven 400px
  estirados y no hay encuadre ni compresión que lo salve. Alto acorde: ≥860px.
- **Apaisado, con el sujeto a la derecha.** La mitad izquierda queda debajo del
  texto y se desvanece: lo que se ponga ahí no se va a ver.
- **Fondo oscuro en el borde izquierdo.** Es donde el arte se funde con el
  panel; un borde claro deja ver el corte.
- **Proporción entre 2:1 y 3:1.** Es la que deja al sujeto grande sin recortarlo.
  Un arte más cuadrado entra completo pero ocupa una franja angosta del banner.

`slot-2.png` (393×162) está por debajo de todo esto y se nota: es el ejemplo de
lo que hay que reemplazar. `slot-3.png` (1717×916) es el ejemplo de lo que sí
funciona.

Agregar o quitar slots se hace en el array `slides` del componente, no acá.
