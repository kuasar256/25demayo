/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta del documento (sección 6.2)
        primary: '#F20732',   // rojo: énfasis, datos, alertas, acciones principales
        secondary: '#07038C', // azul: navegación, encabezados, gráficos
        page: '#F5F6FA',      // fondo de página
        ink: '#1A1A1A',       // texto principal
        muted: '#6C757D',     // texto secundario
        line: '#E5E7EB',      // bordes y separadores
        success: '#28A745',
        warning: '#FFC107',
        danger: '#F20732',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
};
