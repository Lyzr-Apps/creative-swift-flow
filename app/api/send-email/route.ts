import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

/**
 * POST /api/send-email
 * Send email notifications when tickets are created
 *
 * Body:
 * {
 *   to: "recipient@gmail.com",
 *   subject: "New Support Ticket",
 *   customerEmail: "customer@example.com",
 *   customerMessage: "Customer's message/ticket content",
 *   ticketId: "unique-ticket-id"
 * }
 */

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL

// Demo mode - simulate email sending without Gmail credentials
const DEMO_MODE = !GMAIL_USER || !GMAIL_PASSWORD || !NOTIFY_EMAIL

// Create a transporter using Gmail (only if credentials are available)
const transporter = !DEMO_MODE
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASSWORD,
      },
    })
  : null

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      customerEmail,
      customerName = 'Support Customer',
      customerMessage,
      ticketId,
      subject = 'New Support Ticket Created',
    } = body

    // Validate required fields
    if (!customerEmail || !customerMessage || !ticketId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: customerEmail, customerMessage, ticketId',
        },
        { status: 400 }
      )
    }

    // DEMO MODE: Simulate email sending
    if (DEMO_MODE) {
      console.log('Running in DEMO MODE - simulating email send')
      console.log('Would send to:', NOTIFY_EMAIL || 'support@example.com')
      console.log('Ticket:', ticketId)
      console.log('From:', customerEmail)

      return NextResponse.json({
        success: true,
        message: 'Email notification sent successfully (DEMO MODE)',
        messageId: `demo-${Date.now()}@lyzr.demo`,
        ticketId: ticketId,
        timestamp: new Date().toISOString(),
        demo_mode: true,
        note: 'Running in demo mode. Configure GMAIL_USER, GMAIL_PASSWORD, and NOTIFY_EMAIL in .env.local to send real emails.',
      })
    }

    // Create HTML email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background: #f9f9f9;
              border: 1px solid #ddd;
              border-radius: 8px;
            }
            .header {
              background: #2563eb;
              color: white;
              padding: 20px;
              border-radius: 8px 8px 0 0;
              margin: -20px -20px 20px -20px;
            }
            .content {
              background: white;
              padding: 20px;
              border-radius: 4px;
            }
            .field {
              margin: 15px 0;
              border-bottom: 1px solid #eee;
              padding-bottom: 10px;
            }
            .label {
              font-weight: bold;
              color: #2563eb;
            }
            .ticket-id {
              background: #f0f0f0;
              padding: 10px;
              border-radius: 4px;
              font-family: monospace;
              margin-top: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              padding-top: 15px;
              border-top: 1px solid #eee;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Support Ticket</h2>
            </div>
            <div class="content">
              <div class="field">
                <span class="label">Ticket ID:</span>
                <div class="ticket-id">${ticketId}</div>
              </div>
              <div class="field">
                <span class="label">Customer Name:</span>
                <div>${customerName}</div>
              </div>
              <div class="field">
                <span class="label">Customer Email:</span>
                <div>${customerEmail}</div>
              </div>
              <div class="field">
                <span class="label">Message:</span>
                <div style="background: #f9f9f9; padding: 10px; border-radius: 4px; border-left: 3px solid #2563eb;">
                  ${customerMessage.replace(/\n/g, '<br>')}
                </div>
              </div>
              <div class="field">
                <span class="label">Timestamp:</span>
                <div>${new Date().toLocaleString()}</div>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated notification from your support system.</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email (production mode only)
    if (!transporter) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email configuration missing. Set GMAIL_USER, GMAIL_PASSWORD, and NOTIFY_EMAIL in .env.local',
        },
        { status: 500 }
      )
    }

    const info = await transporter.sendMail({
      from: GMAIL_USER,
      to: NOTIFY_EMAIL,
      subject: subject,
      html: htmlContent,
      replyTo: customerEmail,
    })

    console.log('Email sent:', info.messageId)

    return NextResponse.json({
      success: true,
      message: 'Email notification sent successfully',
      messageId: info.messageId,
      ticketId: ticketId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Email sending error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send email notification',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
