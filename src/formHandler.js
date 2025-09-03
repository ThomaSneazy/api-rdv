// Configuration des formulaires
const FORMS_CONFIG = {
    contact: {
        formId: 'contactForm',
        submitId: 'contactSubmit',
        prefix: 'contact_',
        objectCommande: 'Demande de contact',
        memoFields: ['message']
    },
    collab: {
        formId: 'collabForm',
        submitId: 'collabSubmit',
        prefix: 'collab_',
        objectCommande: 'Demande de collaboration',
        memoFields: ['societe', 'message']
    },
    sav: {
        formId: 'savForm',
        submitId: 'savSubmit',
        prefix: 'sav_',
        objectCommande: 'Demande SAV',
        memoFields: ['message']
    },
    privatisation: {
        formId: 'privatisationForm',
        submitId: 'privatisationSubmit',
        prefix: '',
        objectCommande: null,
        memoFields: ['date_evenement', 'type_evenement', 'budget', 'nombre_invites', 'message']
    }
};

// Utilitaires
const getValueById = (id) => document.getElementById(id)?.value || '';

// Gestionnaire de formulaire générique
class FormHandler {
    constructor(config) {
        this.config = config;
        this.form = document.getElementById(config.formId);
        this.submitButton = document.getElementById(config.submitId);

        if (!this.form || !this.submitButton) {
            console.error(`Le formulaire ${config.formId} ou son bouton est manquant`);
            return;
        }

        this.initializeForm();
    }

    getMemoContent() {
        return this.config.memoFields
            .map(field => {
                const label = field.charAt(0).toUpperCase() + field.slice(1);
                return `${label} : ${getValueById(this.config.prefix + field)}`;
            })
            .join('\n');
    }

    getFormData() {
        const memoContent = this.getMemoContent();
        const prefix = this.config.prefix;

        return {
            action: 'contact',
            lg: 'FR',
            civilite: getValueById(prefix + 'civilite'),
            nom: getValueById(prefix + 'nom'),
            prenom: getValueById(prefix + 'prenom'),
            email: getValueById(prefix + 'email'),
            telephone: getValueById(prefix + 'telephone'),
            memo: memoContent,
            remarque: memoContent,
            objet_commande: this.config.objectCommande || getValueById('type_evenement'),
            ...(prefix === 'collab_' && { societe: getValueById('collab_societe') }),
            ...(prefix === '' && { mobile: getValueById('telephone') })
        };
    }

    async submitForm(e) {
        e.preventDefault();
        
        if (this.submitButton) {
            this.submitButton.disabled = true;
            this.submitButton.innerText = 'Envoi en cours...';
        }
        
        try {
            const NETLIFY_FUNCTION_URL = 'https://api-cdl.netlify.app/.netlify/functions/submitForm';
            console.log('Envoi des données au formulaire:', this.getFormData());

            const response = await fetch(NETLIFY_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.getFormData())
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Réponse complète:', result);

            if (result.erreur === 0) {
                this.form.reset();
                const successMessage = document.createElement('div');
                successMessage.className = 'form-success';
                successMessage.innerText = 'Votre message a été envoyé avec succès.';
                this.form.appendChild(successMessage);
                console.log(`Formulaire ${this.config.formId} soumis avec succès, ID: ${result.id_contact}`);
            } else {
                throw new Error(result.message_erreur || 'Erreur lors de la soumission du formulaire');
            }
        } catch (error) {
            console.error('Erreur détaillée:', error);
            
            const errorMessage = document.createElement('div');
            errorMessage.className = 'form-error';
            errorMessage.innerText = `Erreur: ${error.message}`;
            this.form.appendChild(errorMessage);
        } finally {
            if (this.submitButton) {
                this.submitButton.disabled = false;
                this.submitButton.innerText = 'Envoyer';
            }
        }
    }

    initializeForm() {
        this.form.addEventListener('submit', (e) => this.submitForm(e));
    }
}

// Fonction d'initialisation
function initForms() {
    Object.values(FORMS_CONFIG).forEach(config => new FormHandler(config));
}

// Initialisation automatique au chargement du DOM
document.addEventListener('DOMContentLoaded', initForms); 