const { createApp } = Vue;

createApp({
    data() {
        return {
            messages: [],
            userInput: '',
            isLoading: false,
            statusText: 'Conectando...',
            statusClass: 'offline',
            showToolsModal: false,
            availableTools: [],
            apiUrl: 'http://localhost:3000'
        }
    },
    mounted() {
        this.checkHealth();
        this.loadTools();
    },
    methods: {
        async checkHealth() {
            try {
                const response = await axios.get(`${this.apiUrl}/ia/health`);
                if (response.data.success) {
                    this.statusText = 'En línea';
                    this.statusClass = 'online';
                } else {
                    this.statusText = 'Error';
                    this.statusClass = 'offline';
                }
            } catch (error) {
                this.statusText = 'Sin conexión';
                this.statusClass = 'offline';
                console.error('Error checking health:', error);
            }
        },

        async loadTools() {
            try {
                const response = await axios.get(`${this.apiUrl}/ia/tools`);
                if (response.data.success) {
                    this.availableTools = response.data.tools;
                }
            } catch (error) {
                console.error('Error loading tools:', error);
            }
        },

        async sendMessage() {
            if (!this.userInput.trim() || this.isLoading) return;

            const userMessage = {
                type: 'user',
                text: this.userInput,
                time: this.getCurrentTime()
            };

            this.messages.push(userMessage);
            const messageText = this.userInput;
            this.userInput = '';

            // Add loading message
            const loadingMessage = {
                type: 'bot',
                text: '',
                loading: true,
                time: this.getCurrentTime()
            };
            this.messages.push(loadingMessage);
            this.scrollToBottom();

            this.isLoading = true;

            try {
                const response = await axios.post(`${this.apiUrl}/ia/query`, {
                    message: messageText
                });

                // Remove loading message
                this.messages.pop();

                if (response.data.success) {
                    const botMessage = {
                        type: 'bot',
                        text: response.data.response,
                        tools: response.data.metadata?.toolsExecuted || [],
                        time: this.getCurrentTime()
                    };
                    this.messages.push(botMessage);
                } else {
                    const errorMessage = {
                        type: 'bot',
                        text: `❌ Error: ${response.data.error || 'Error desconocido'}\n\n💡 **Solución**: La API Key de Google Gemini no es válida.\n\n1. Ve a https://aistudio.google.com/app/apikey\n2. Crea una nueva API Key\n3. Actualízala en apps/api-gateway/.env\n4. Reinicia el servidor (npm run start:dev)`,
                        time: this.getCurrentTime()
                    };
                    this.messages.push(errorMessage);
                }
            } catch (error) {
                // Remove loading message
                this.messages.pop();

                let errorText = '❌ Error de conexión: ';
                
                if (error.response?.data?.error) {
                    if (error.response.data.error.includes('API key not valid')) {
                        errorText = `❌ **API Key Inválida**\n\nLa API Key de Google Gemini no es válida o ha expirado.\n\n✅ **Solución rápida:**\n1. Ve a: https://aistudio.google.com/app/apikey\n2. Inicia sesión con tu cuenta de Google\n3. Crea una nueva API Key (es GRATIS)\n4. Copia la API Key completa\n5. Pégala en: apps/api-gateway/.env\n   (Reemplaza GEMINI_API_KEY=...)\n6. Reinicia el servidor del API Gateway`;
                    } else {
                        errorText += error.response.data.error;
                    }
                } else {
                    errorText += `${error.message}\n\nVerifica que todos los servicios estén corriendo:\n- MCP Server (puerto 3001)\n- API Gateway (puerto 3000)\n- Backend (puerto 3003)`;
                }

                const errorMessage = {
                    type: 'bot',
                    text: errorText,
                    time: this.getCurrentTime()
                };
                this.messages.push(errorMessage);
                console.error('Error sending message:', error);
            }

            this.isLoading = false;
            this.scrollToBottom();
        },

        sendSuggestion(text) {
            this.userInput = text;
            this.sendMessage();
        },

        clearChat() {
            if (confirm('¿Limpiar todo el chat?')) {
                this.messages = [];
            }
        },

        showTools() {
            this.showToolsModal = true;
        },

        getCurrentTime() {
            const now = new Date();
            return now.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        },

        formatMessage(text) {
            // Convert markdown-style formatting
            let formatted = text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>')
                .replace(/`(.*?)`/g, '<code>$1</code>');
            
            // Add emoji support
            return formatted;
        },

        scrollToBottom() {
            this.$nextTick(() => {
                const messagesArea = this.$refs.messagesArea;
                if (messagesArea) {
                    messagesArea.scrollTop = messagesArea.scrollHeight;
                }
            });
        }
    }
}).mount('#app');
