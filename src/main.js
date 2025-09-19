// Configuration des formulaires pour booking_multiple
const FORMS_CONFIG = {
    contact: {
        formId: 'contactForm',
        submitId: 'contactSubmit',
        prefix: 'contact_',
        productCode: 'CONTACT_FORM',
        objectCommande: 'Demande de contact',
        memoFields: ['message']
    },
    collab: {
        formId: 'collabForm',
        submitId: 'collabSubmit',
        prefix: 'collab_',
        productCode: 'COLLAB_FORM',
        objectCommande: 'Demande de collaboration',
        memoFields: ['societe', 'message']
    },
    sav: {
        formId: 'savForm',
        submitId: 'savSubmit',
        prefix: 'sav_',
        productCode: 'SAV_FORM',
        objectCommande: 'Demande SAV',
        memoFields: ['message']
    },
    privatisation: {
        formId: 'privatisationForm',
        submitId: 'privatisationSubmit',
        prefix: '',
        productCode: 'PRIVATISATION_FORM',
        objectCommande: null,
        memoFields: ['date_evenement', 'type_evenement', 'budget', 'nombre_invites', 'message']
    }
};

// Utilitaire
const getValueById = (id) => document.getElementById(id)?.value || '';

// Gestionnaire de formulaire pour booking_multiple
class FormHandler {
    constructor(config) {
        this.config = config;
        this.form = document.getElementById(config.formId);
        this.submitButton = document.getElementById(config.submitId);

        if (!this.form || !this.submitButton) {
            console.log(`Formulaire ${config.formId} non trouvé sur cette page`);
            return;
        }

        this.initializeForm();
    }

    getMemoContent() {
        return this.config.memoFields
            .map(field => {
                const label = field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ');
                const value = getValueById(this.config.prefix + field);
                return value ? `${label}: ${value}` : '';
            })
            .filter(line => line) // Enlever les lignes vides
            .join('\n');
    }

    generateOrderReference() {
        const timestamp = Date.now();
        const formType = this.config.formId.replace('Form', '').toUpperCase();
        return `${formType}_${timestamp}`;
    }

    getFormData() {
        const memoContent = this.getMemoContent();
        const prefix = this.config.prefix;
        
        // Détection de l'URL pour le préfixe d'objet
        let objetPrefix = '';
        if (window.location.href.includes('fromage')) {
            objetPrefix = 'Fromagerie - ';
        } else if (window.location.href.includes('cave')) {
            objetPrefix = 'Caves - ';
        }

        // Construction des données selon le format booking_multiple
        const formData = {
            action: 'booking_multiple',
            lg: 'FR',
            
            // Informations client (champs obligatoires marqués *)
            civilite: getValueById(prefix + 'civilite') || 'Monsieur',
            nom: getValueById(prefix + 'nom'), // *
            prenom: getValueById(prefix + 'prenom') || '',
            email: getValueById(prefix + 'email') || '',
            telephone: getValueById(prefix + 'telephone') || '',
            mobile: getValueById(prefix + 'mobile') || getValueById(prefix + 'telephone') || '',
            
            // Adresse (peut être vide pour les demandes de contact)
            societe: getValueById(prefix + 'societe') || '',
            adresse: getValueById(prefix + 'adresse') || '',
            ville: getValueById(prefix + 'ville') || '',
            code_postal: getValueById(prefix + 'code_postal') || '',
            pays: getValueById(prefix + 'pays') || 'France',
            
            // Référence et commentaires
            ref_commande: this.generateOrderReference(), // *
            remarque: memoContent, // Visible par le client
            memo: `${objetPrefix}${this.config.objectCommande || getValueById('type_evenement')}\n\n${memoContent}`, // Visible uniquement dans TourBiz
            
            // Code revendeur (à configurer avec votre vraie valeur) *
            code_revendeur: 'DEFAULT_RESELLER', // IMPORTANT: Remplacez par votre code revendeur réel
            
            // Prestation (au moins une ligne obligatoire) *
            prestation: [
                {
                    code: this.config.productCode, // * Code du produit
                    date: new Date().toISOString().split('T')[0], // * Date du jour au format YYYY-MM-DD
                    numero_session: '1', // Numéro de session
                    adulte: '1', // * Nombre d'adultes
                    enfant: '0', // * Nombre d'enfants
                    tarif_adulte: '0.00', // * Tarif TTC par adulte
                    tarif_enfant: '0.00', // * Tarif TTC par enfant
                    forfait: 1 // 1 = tarif forfaitaire qui ne dépend pas du nombre de personnes
                }
            ]
        };

        // Ajout conditionnel pour le formulaire de collaboration
        if (prefix === 'collab_') {
            formData.societe = getValueById('collab_societe') || '';
        }

        return formData;
    }

    async submitForm(e) {
        e.preventDefault();
        
        // Validation basique
        const prefix = this.config.prefix;
        const nom = getValueById(prefix + 'nom');
        
        if (!nom) {
            alert('Le nom est obligatoire');
            return;
        }

        if (this.submitButton) {
            this.submitButton.disabled = true;
            this.submitButton.innerText = 'Envoi en cours...';
        }
        
        try {
            const NETLIFY_FUNCTION_URL = 'https://api-rdv.netlify.app/.netlify/functions/submitForm';
            const formData = this.getFormData();
            
            console.log('Envoi des données booking_multiple:', formData);

            const response = await fetch(NETLIFY_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Réponse complète:', result);

            // Vérification du succès (booking_multiple retourne un numéro de commande ou "TEST OK")
            if (result.erreur === 0 || result.erreur === "0" || typeof result === 'string') {
                this.form.reset();
                this.clearMessages(); // Nettoyer les anciens messages
                
                const successMessage = document.createElement('div');
                successMessage.className = 'form-success';
                
                if (typeof result === 'string' && result.includes('TEST')) {
                    successMessage.innerText = 'Votre message a été envoyé avec succès (mode test).';
                } else {
                    const commandeId = typeof result === 'string' ? result : result.id_commande || 'Inconnue';
                    successMessage.innerText = `Votre message a été envoyé avec succès. Référence: ${commandeId}`;
                }
                
                this.form.appendChild(successMessage);
                console.log(`Formulaire ${this.config.formId} soumis avec succès:`, result);
                
                // Faire disparaître le message après 5 secondes
                setTimeout(() => {
                    if (successMessage.parentNode) {
                        successMessage.remove();
                    }
                }, 5000);
                
            } else {
                throw new Error(result.message_erreur || result.erreur || 'Erreur lors de la soumission du formulaire');
            }
        } catch (error) {
            console.error('Erreur détaillée:', error);
            
            this.clearMessages(); // Nettoyer les anciens messages
            const errorMessage = document.createElement('div');
            errorMessage.className = 'form-error';
            
            // Messages d'erreur plus explicites
            if (error.message.includes('methode inconnue')) {
                errorMessage.innerText = 'Erreur de configuration: La méthode API n\'est pas reconnue.';
            } else if (error.message.includes('Timeout')) {
                errorMessage.innerText = 'Délai d\'attente dépassé. Veuillez réessayer.';
            } else if (error.message.includes('Configuration du serveur')) {
                errorMessage.innerText = 'Erreur de configuration du serveur. Contactez l\'administrateur.';
            } else {
                errorMessage.innerText = `Erreur: ${error.message}`;
            }
            
            this.form.appendChild(errorMessage);
            
            // Faire disparaître le message d'erreur après 8 secondes
            setTimeout(() => {
                if (errorMessage.parentNode) {
                    errorMessage.remove();
                }
            }, 8000);
            
        } finally {
            if (this.submitButton) {
                this.submitButton.disabled = false;
                this.submitButton.innerText = 'Envoyer';
            }
        }
    }

    clearMessages() {
        // Supprimer tous les anciens messages de succès et d'erreur
        const oldMessages = this.form.querySelectorAll('.form-success, .form-error');
        oldMessages.forEach(msg => msg.remove());
    }

    initializeForm() {
        this.form.addEventListener('submit', (e) => this.submitForm(e));
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initialisation des formulaires avec booking_multiple');
    Object.values(FORMS_CONFIG).forEach(config => {
        if (document.getElementById(config.formId)) {
            console.log(`Initialisation du formulaire: ${config.formId}`);
            new FormHandler(config);
        }
    });
});