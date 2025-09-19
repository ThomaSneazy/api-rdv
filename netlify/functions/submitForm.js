// netlify/functions/submitForm.js
let fetch;
try {
    fetch = global.fetch;
} catch (e) {
    fetch = require('node-fetch');
}

exports.handler = async (event, context) => {
    // Gestion des requêtes OPTIONS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
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
    const CODE_REVENDEUR = process.env.CODE_REVENDEUR; // Nouvelle variable pour le code revendeur

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
        
        // Récupération et préparation des données
        const formData = JSON.parse(event.body);
        
        // Ajout des identifiants et du code revendeur
        formData.login = LOGIN;
        formData.pass = PASSWORD;
        
        // Si un code revendeur est configuré, l'utiliser ; sinon garder celui du formulaire
        if (CODE_REVENDEUR) {
            formData.code_revendeur = CODE_REVENDEUR;
        }

        console.log("URL de l'API:", API_URL);
        console.log("Action:", formData.action);
        console.log("Données envoyées (sans identifiants):", {
            ...formData,
            login: '[HIDDEN]',
            pass: '[HIDDEN]'
        });

        // Préparation des données selon la méthode
        let postData;
        if (formData.action === 'booking_multiple') {
            // Pour booking_multiple, on envoie les données en JSON
            postData = formData;
        } else {
            // Pour les autres méthodes, on utilise URLSearchParams
            postData = new URLSearchParams(formData);
        }

        console.log("Type de données envoyées:", typeof postData);

        // Configuration de la requête
        const requestOptions = {
            method: 'POST',
            headers: {}
        };

        if (formData.action === 'booking_multiple') {
            // Pour booking_multiple, certains paramètres peuvent être en JSON
            const formDataForUrl = new URLSearchParams();
            
            // Ajouter tous les champs simples
            Object.keys(formData).forEach(key => {
                if (key !== 'prestation' && typeof formData[key] !== 'object') {
                    formDataForUrl.append(key, formData[key]);
                }
            });
            
            // Ajouter les prestations (format spécial pour l'API)
            if (formData.prestation && Array.isArray(formData.prestation)) {
                formData.prestation.forEach((prestation, index) => {
                    Object.keys(prestation).forEach(field => {
                        formDataForUrl.append(`prestation[${index}][${field}]`, prestation[field]);
                    });
                });
            }
            
            requestOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            requestOptions.body = formDataForUrl;
        } else {
            requestOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            requestOptions.body = postData;
        }

        // Ajout du timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout - L\'API n\'a pas répondu dans le délai imparti')), 15000)
        );
        
        const fetchPromise = fetch(API_URL, requestOptions);
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (!response.ok) {
            console.error(`Erreur HTTP: ${response.status} ${response.statusText}`);
            return {
                statusCode: 502,
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
        
        // Traitement de la réponse
        let responseText;
        try {
            responseText = await response.text();
            console.log("Réponse brute de l'API:", responseText);

            // Tentative de parsing JSON
            let result;
            try {
                result = JSON.parse(responseText);
                console.log("Réponse parsée:", result);
            } catch (parseError) {
                // Si ce n'est pas du JSON, peut-être une réponse simple pour booking_multiple
                console.log("Réponse non-JSON, probablement une réponse simple:", responseText);
                
                // Pour booking_multiple, une réponse simple peut être le numéro de commande ou "TEST OK"
                if (formData.action === 'booking_multiple') {
                    result = {
                        erreur: 0,
                        id_commande: responseText.trim(),
                        message: responseText.trim()
                    };
                } else {
                    throw parseError;
                }
            }

            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(result)
            };

        } catch (parseError) {
            console.error("Erreur de parsing:", parseError);
            console.error("Réponse brute:", responseText);
            
            return {
                statusCode: 502,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    error: "Impossible de parser la réponse de l'API", 
                    responseText: responseText,
                    parseError: parseError.message
                })
            };
        }
        
    } catch (error) {
        console.error("Erreur générale:", error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: "Erreur de soumission", 
                details: error.message
            })
        };
    }
};