import 'react-leaflet'

declare module 'react-leaflet' {
  interface MapContainerProps {
    rotate?: boolean
    bearing?: number
    touchRotate?: boolean
    rotateControl?: boolean
  }
}
