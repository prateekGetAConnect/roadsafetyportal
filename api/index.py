"""Flask Backend for India Transport Analytics POC - Vercel Serverless Function."""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

# Load environment variables (Vercel automatically provides them, but this helps for local Vercel CLI testing)
load_dotenv()

app = Flask(__name__)
CORS(app)

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')

# Initialize Twilio Client
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

@app.route('/api/alerts/sms', methods=['POST'])
def send_sms_alert():
    """Endpoint to dispatch SMS alerts via Twilio."""
    data = request.json
    
    if not data:
        return jsonify({'error': 'Invalid request data'}), 400
        
    recipient = data.get('contact')
    message_body = data.get('message')
    
    if not recipient or not message_body:
        return jsonify({'error': 'Missing contact or message'}), 400
        
    if not twilio_client:
        return jsonify({
            'error': 'Twilio credentials not configured on the server.'
        }), 500
        
    if not TWILIO_PHONE_NUMBER:
        return jsonify({
            'error': 'TWILIO_PHONE_NUMBER not configured on the server.'
        }), 500

    try:
        message = twilio_client.messages.create(
            body=message_body,
            from_=TWILIO_PHONE_NUMBER,
            to=recipient
        )
        return jsonify({
            'success': True,
            'messageId': message.sid,
            'status': message.status
        })
    except TwilioRestException as e:
        return jsonify({
            'error': str(e)
        }), 500
    except Exception as e:
        return jsonify({
            'error': f"An unexpected error occurred: {str(e)}"
        }), 500
