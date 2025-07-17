/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADDRESS_CONTRACT_AMOY: string
  readonly VITE_ADDRESS_CONTRACT_ALASTRIA: string
  readonly VITE_PRIVATE_KEY_ADMIN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
