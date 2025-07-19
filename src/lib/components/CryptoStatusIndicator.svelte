<script lang="ts">
  import { ZenroomHelpers } from '../../utils/crypto.helpers'; // Nueva importación
  
  // Todo el resto del código funciona igual
  async function checkCryptoStatus() {
    try {
      const success = await ZenroomHelpers.initialize(); // Misma API
      // ... resto igual
    } catch (error) {
      // ... manejo de errores igual
    }
  }
</script>