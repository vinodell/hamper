/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_PHONE_MAKS: string;
	readonly VITE_PHONE_VLAD: string;
	readonly VITE_PHONE_HREF: string;
	readonly VITE_WHATSAPP_MAKS: string;
	readonly VITE_WHATSAPP_VLAD: string;
	readonly VITE_TELEGRAM_MAKS: string;
	readonly VITE_TELEGRAM_VLAD: string;
	readonly VITE_CONTACT_EMAIL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
