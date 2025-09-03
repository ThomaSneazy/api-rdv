// netlify/functions/submitForm.js
// En Netlify Functions, il faut importer fetch différemment selon la version de Node
let fetch;
try {
    // Pour Node.js 18+
    fetch = global.fetch;
} catch (e) {
    // Pour Node.js < 18
    fetch = require('node-fetch');
}

exports.handler = async (event, context) => {
    // Gestion explicite des requêtes OPTIONS (preflight)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204, // No content pour les requêtes OPTIONS
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            body: ''
        };
    }

    // Variables d'environnement
    const API_URL = process.env.API_URL;
    const LOGIN = process.env.CONTACT_LOGIN;
    const PASSWORD = process.env.CONTACT_PASSWORD;

    if (!event.body) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: "Données du formulaire manquantes" })
        };
    }

    try {
        // Vérifications des variables d'environnement
        if (!API_URL) {
            console.error("API_URL n'est pas définie");
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: "Configuration du serveur incorrecte: API_URL manquante" })
            };
        }
        
        if (!LOGIN || !PASSWORD) {
            console.error("Identifiants manquants");
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: "Configuration du serveur incorrecte: Identifiants manquants" })
            };
        }
        
        // Récupération des données du formulaire
        const formData = JSON.parse(event.body);
        formData.login = LOGIN;
        formData.pass = PASSWORD;

        console.log("Tentative d'envoi à l'API:", API_URL);
        console.log("Données:", JSON.stringify(formData));

        // Appel à l'API externe
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout - L\'API n\'a pas répondu dans le délai imparti')), 10000)
        );
        
        const fetchPromise = fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept-Charset': 'UTF-8'
            },
            body: new URLSearchParams(formData)
        });
        
        // Course entre le fetch et le timeout
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        // Traitement de la réponse
        if (!response.ok) {
            console.error(`Erreur HTTP: ${response.status} ${response.statusText}`);
            return {
                statusCode: 502, // Bad Gateway
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: "L'API externe a retourné une erreur", 
                    status: response.status,
                    statusText: response.statusText
                })
            };
        }
        
        // Tentative de parse du JSON
        let responseText;
        try {
            responseText = await response.text();
            console.log("Réponse brute:", responseText);
            const result = JSON.parse(responseText);
            console.log("Réponse de l'API (parsée):", JSON.stringify(result));

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(result)
            };
        } catch (parseError) {
            console.error("Erreur de parsing JSON:", parseError);
            return {
                statusCode: 502,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: "Impossible de parser la réponse de l'API", 
                    responseText: responseText
                })
            };
        }
    } catch (error) {
        console.error("Erreur lors du traitement:", error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: "Erreur de soumission", 
                details: error.message,
                stack: error.stack
            })
        };
    }
};