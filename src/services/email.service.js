// Email service using SendGrid
require('dotenv').config();
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid API key loaded successfully');
} else {
  console.warn('❌ SENDGRID_API_KEY not found in environment variables');
}

// Send single email
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourcompany.com',
      subject,
      text,
      html,
    };

    const result = await sgMail.send(msg);
    console.log('Email sent successfully to:', to);
    return {
      success: true,
      messageId: result[0].headers['x-message-id'],
      status: 'SENT'
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message,
      status: 'FAILED'
    };
  }
};

// Send bulk emails
const sendBulkEmails = async (emails) => {
  try {
    const messages = emails.map(email => ({
      to: email.to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourcompany.com',
      subject: email.subject,
      text: email.text,
      html: email.html,
    }));

    const results = await sgMail.send(messages);
    console.log(`Bulk emails sent successfully: ${messages.length} emails`);
    
    return results.map((result, index) => ({
      to: emails[index].to,
      success: true,
      messageId: result.headers['x-message-id'],
      status: 'SENT'
    }));
  } catch (error) {
    console.error('Error sending bulk emails:', error);
    throw error;
  }
};

// Personalize message template
const personalizeMessage = (template, customer) => {
  let personalizedMessage = template;
  
  // Replace common placeholders with customer data
  personalizedMessage = personalizedMessage.replace(/\{\{?firstName\}?\}/g, customer.first_name || 'Valued Customer');
  personalizedMessage = personalizedMessage.replace(/\{\{?customer_first_name\}?\}/g, customer.first_name || 'Valued Customer');
  personalizedMessage = personalizedMessage.replace(/\{\{?customerfirst_name\}?\}/g, customer.first_name || 'Valued Customer');
  personalizedMessage = personalizedMessage.replace(/\{\{?lastName\}?\}/g, customer.last_name || '');
  personalizedMessage = personalizedMessage.replace(/\{\{?customer_last_name\}?\}/g, customer.last_name || '');
  personalizedMessage = personalizedMessage.replace(/\{\{?email\}?\}/g, customer.email || '');
  personalizedMessage = personalizedMessage.replace(/\{\{?phone\}?\}/g, customer.phone || '');
  personalizedMessage = personalizedMessage.replace(/\{\{?totalSpend\}?\}/g, customer.total_spend || '0');
  personalizedMessage = personalizedMessage.replace(/\{\{?totalVisits\}?\}/g, customer.total_visits || '0');
  
  // Add more dynamic content
  personalizedMessage = personalizedMessage.replace(/\{\{?customerName\}?\}/g, `${customer.first_name} ${customer.last_name}`.trim() || 'Valued Customer');
  personalizedMessage = personalizedMessage.replace(/\{\{?customer_name\}?\}/g, `${customer.first_name} ${customer.last_name}`.trim() || 'Valued Customer');
  
  return personalizedMessage;
};

// Generate professional HTML email template
const generateEmailHTML = (message, customer) => {
  const customerName = customer ? `${customer.first_name} ${customer.last_name}`.trim() || customer.first_name || 'Valued Customer' : 'Valued Customer';
  const firstName = customer ? customer.first_name || 'Valued Customer' : 'Valued Customer';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Important Message from Your Business Partner</title>
        <style>
            body {
                font-family: 'Arial', 'Helvetica', sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f4f4f4;
                color: #333333;
                line-height: 1.6;
            }
            .email-container {
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                border: 1px solid #e0e0e0;
            }
            .header {
                background-color: #2c3e50;
                color: #ffffff;
                padding: 30px 25px;
                text-align: center;
                border-bottom: 3px solid #34495e;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 400;
                letter-spacing: 0.5px;
            }
            .content {
                padding: 35px 25px;
            }
            .greeting {
                margin-bottom: 25px;
                border-bottom: 1px solid #e9ecef;
                padding-bottom: 15px;
            }
            .greeting h2 {
                color: #2c3e50;
                margin: 0;
                font-size: 22px;
                font-weight: 400;
            }
            .message-content {
                background-color: #f8f9fa;
                padding: 25px;
                border-left: 4px solid #3498db;
                margin: 25px 0;
                border-radius: 3px;
            }
            .message-content p {
                margin: 0;
                font-size: 16px;
                line-height: 1.7;
                color: #555555;
            }
            .offer-highlight {
                background: linear-gradient(135deg, #e8f4fd 0%, #d1ecf1 100%);
                border: 1px solid #3498db;
                padding: 20px;
                border-radius: 5px;
                text-align: center;
                margin: 25px 0;
            }
            .offer-code {
                background: #ffffff;
                border: 2px dashed #3498db;
                padding: 12px 20px;
                border-radius: 5px;
                font-family: 'Courier New', monospace;
                font-size: 18px;
                font-weight: bold;
                color: #2c3e50;
                margin: 15px 0;
                display: inline-block;
            }
            .cta-section {
                text-align: center;
                margin: 30px 0;
            }
            .cta-button {
                display: inline-block;
                background-color: #3498db;
                color: #ffffff;
                padding: 14px 30px;
                text-decoration: none;
                border-radius: 3px;
                font-weight: 600;
                font-size: 16px;
                transition: background-color 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .cta-button:hover {
                background-color: #2980b9;
            }
            .footer {
                background-color: #34495e;
                color: #ffffff;
                padding: 25px;
                text-align: center;
                border-top: 1px solid #2c3e50;
            }
            .footer h3 {
                margin: 0 0 15px 0;
                font-size: 18px;
                font-weight: 400;
            }
            .footer p {
                margin: 8px 0;
                font-size: 14px;
                color: #bdc3c7;
            }
            .divider {
                height: 1px;
                background-color: #e9ecef;
                margin: 25px 0;
            }
            .disclaimer {
                font-size: 12px;
                color: #95a5a6;
                text-align: center;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid #2c3e50;
            }
            @media (max-width: 600px) {
                .email-container { margin: 0 10px; }
                .content, .header, .footer { padding: 20px 15px; }
                .message-content { padding: 20px 15px; }
                .cta-button { padding: 12px 25px; font-size: 14px; }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h1>Business Communication</h1>
            </div>
            
            <div class="content">
                <div class="greeting">
                    <h2>Dear ${firstName},</h2>
                </div>
                
                <div class="message-content">
                    <p>${message.replace(/\n/g, '<br>')}</p>
                </div>
                
                ${message.includes('WELCOME10') || message.includes('10%') || message.toLowerCase().includes('discount') ? `
                <div class="offer-highlight">
                    <h3 style="color: #2c3e50; margin: 0 0 15px 0;">Exclusive Offer</h3>
                    <div class="offer-code">
                        WELCOME10
                    </div>
                    <p style="margin: 15px 0 0 0; color: #555; font-size: 14px;">
                        Save 10% on your next purchase
                    </p>
                </div>
                ` : ''}
                
                <div class="cta-section">
                    <a href="#" class="cta-button">View Our Products</a>
                </div>
                
                <div class="divider"></div>
                
                <p style="font-size: 14px; color: #7f8c8d; text-align: center; margin: 0;">
                    We value your business relationship and are committed to providing exceptional service.
                </p>
            </div>
            
            <div class="footer">
                <h3>Best Regards,</h3>
                <p>Customer Relations Department</p>
                <p>Your Trusted Business Partner</p>
                
                <div class="disclaimer">
                    This is a business communication. If you have any questions, please contact our customer service team.
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

module.exports = {
  sendEmail,
  sendBulkEmails,
  sendCampaignEmail: async ({ to, subject, message, customer }) => {
    try {
      const personalizedMessage = personalizeMessage(message, customer);
      const emailHTML = generateEmailHTML(personalizedMessage, customer);
      
      return await sendEmail({
        to,
        subject,
        html: emailHTML,
        text: personalizedMessage
      });
    } catch (error) {
      console.error('Campaign email sending failed:', error);
      return {
        success: false,
        error: error.message,
        status: 'FAILED'
      };
    }
  },
  personalizeMessage,
  generateEmailHTML,
};
