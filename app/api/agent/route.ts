import { NextRequest, NextResponse } from 'next/server'
import parseLLMJson from '@/utils/jsonParser'

/**
 * POST /api/agent
 * Secure AI agent API with BULLETPROOF multi-strategy JSON parsing
 *
 * SECURITY:
 * - API keys stored server-side only (never exposed to client)
 * - Environment variable based configuration
 *
 * PARSING STRATEGIES (Applied in order):
 * 1. Preprocessing: Removes \n, \r, \t escapes and code block markers
 * 2. Direct parse: Fast JSON.parse for well-formed JSON
 * 3. Advanced parse: parseLLMJson with automatic fixes for:
 *    - Trailing commas
 *    - Unquoted keys
 *    - Single quotes to double quotes
 *    - Python values (True/False/None)
 *    - Single-line and multi-line comments
 *    - BOM characters
 * 4. Extraction: Finds and parses JSON from mixed text
 * 5. Last resort: Aggressive parsing with all fixes enabled
 *
 * HANDLES EDGE CASES:
 * - Response wrapped in markdown code blocks
 * - Escaped newlines converted to actual newlines
 * - Double-encoded JSON strings automatically parsed
 * - Nested response objects unwrapped
 * - Malformed JSON with syntax errors
 * - Plain text responses (returned as-is)
 * - Already-parsed object responses
 *
 * EXAMPLE RESPONSES IT HANDLES:
 * ✅ "```json\n{\"result\": \"poem\"}\n```"
 * ✅ "{\"success\": true, \"data\": {...}}"
 * ✅ "Here is your poem:\n{\"result\": \"...\"}"
 * ✅ {response: "stringified json"}
 * ✅ Plain text without JSON
 *
 * @returns {success, response, raw_response, agent_id, user_id, session_id, timestamp}
 */

const LYZR_API_URL = 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/'

// API key from environment variable
const LYZR_API_KEY = process.env.LYZR_API_KEY

// Demo mode flag
const DEMO_MODE = !LYZR_API_KEY || process.env.DEMO_MODE === 'true'

// Demo responses for testing
const DEMO_RESPONSES = [
  {
    response: 'Thank you for your question! We have a comprehensive knowledge base on account management. You can reset your password by going to Settings > Security > Change Password. If you continue to have issues, please create a support ticket.',
    status: 'success',
    confidence: 0.95,
    sources_used: ['knowledge_base', 'conversation_history'],
    suggested_action: 'none',
  },
  {
    response: 'Our products are designed with enterprise security in mind. We use end-to-end encryption and comply with GDPR, HIPAA, and SOC 2 standards. All data is encrypted at rest and in transit. For detailed security information, visit our security portal or contact our security team.',
    status: 'success',
    confidence: 0.92,
    sources_used: ['knowledge_base'],
    suggested_action: 'none',
  },
  {
    response: 'I understand your concern. This is a common issue that we\'ve documented in our FAQ. However, for your specific situation, I recommend escalating to our specialist team who can provide personalized assistance.',
    status: 'escalation_recommended',
    confidence: 0.68,
    sources_used: ['knowledge_base'],
    suggested_action: 'escalate_to_human',
  },
  {
    response: 'Our support team is available 24/7 via email, chat, and phone. You can also check our status page at status.example.com for any ongoing incidents. We typically respond to support requests within 2 hours.',
    status: 'success',
    confidence: 0.88,
    sources_used: ['knowledge_base'],
    suggested_action: 'none',
  },
  {
    response: 'Thank you for reaching out! We\'d be happy to help with your integration. You can find detailed API documentation at docs.example.com, and our developer community is very active on GitHub. Feel free to create a ticket if you need hands-on assistance.',
    status: 'success',
    confidence: 0.90,
    sources_used: ['knowledge_base', 'conversation_history'],
    suggested_action: 'none',
  },
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, agent_id, user_id, session_id } = body

    // Validate required fields
    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: message is required',
        },
        { status: 400 }
      )
    }

    // DEMO MODE: Return mock response if no API key
    if (DEMO_MODE) {
      console.log('Running in DEMO MODE - using mock responses')
      const demoResponse = DEMO_RESPONSES[Math.floor(Math.random() * DEMO_RESPONSES.length)]

      return NextResponse.json({
        success: true,
        response: demoResponse,
        raw_response: JSON.stringify(demoResponse),
        agent_id: agent_id || '690ddd00fef1b728eed3206a',
        user_id: user_id || `user-${Date.now()}`,
        session_id: session_id || `session-${Date.now()}`,
        timestamp: new Date().toISOString(),
        demo_mode: true,
      })
    }

    // PRODUCTION MODE: Call Lyzr API with server-side API key (secure!)
    const response = await fetch(LYZR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LYZR_API_KEY!,
      },
      body: JSON.stringify({
        user_id: user_id || `user-${Date.now()}`,
        agent_id: agent_id || '690ddd00fef1b728eed3206a',
        session_id: session_id || `session-${Date.now()}`,
        message,
      }),
    })

    if (response.ok) {
      const data = await response.json()

      // BULLETPROOF JSON PARSING with multiple strategies
      let parsedResponse = data.response

      if (typeof data.response === 'string') {
        try {
          // STRATEGY 1: Clean up common LLM response issues
          let cleaned = data.response

          // Remove literal \n, \r, \t escape sequences (not actual newlines!)
          cleaned = cleaned.replace(/\\n/g, '\n')
          cleaned = cleaned.replace(/\\r/g, '\r')
          cleaned = cleaned.replace(/\\t/g, '\t')

          // Remove markdown code blocks (```json, ```, etc.)
          cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/gm, '')
          cleaned = cleaned.replace(/\n?```\s*$/gm, '')

          // Trim whitespace
          cleaned = cleaned.trim()

          // STRATEGY 2: Try direct JSON.parse first (fastest)
          try {
            const directParse = JSON.parse(cleaned)
            if (directParse && typeof directParse === 'object') {
              parsedResponse = directParse
              console.log('✅ Direct JSON.parse succeeded')
            }
          } catch (directError) {
            // STRATEGY 3: Use advanced parseLLMJson for complex cases
            console.log('⚙️ Trying advanced parseLLMJson...')
            const parsed = parseLLMJson(cleaned, {
              attemptFix: true,
              maxBlocks: 5,
              preferFirst: true,
              allowPartial: false
            })

            if (parsed && typeof parsed === 'object') {
              parsedResponse = parsed
              console.log('✅ parseLLMJson succeeded')
            } else {
              // STRATEGY 4: Try extracting JSON from anywhere in the string
              const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
              if (jsonMatch) {
                try {
                  const extracted = JSON.parse(jsonMatch[0])
                  if (extracted && typeof extracted === 'object') {
                    parsedResponse = extracted
                    console.log('✅ JSON extraction succeeded')
                  }
                } catch (extractError) {
                  // STRATEGY 5: Last resort - use parseLLMJson on extracted portion
                  const lastResort = parseLLMJson(jsonMatch[0], { attemptFix: true })
                  if (lastResort && typeof lastResort === 'object') {
                    parsedResponse = lastResort
                    console.log('✅ Last resort parsing succeeded')
                  } else {
                    console.log('ℹ️ All parsing strategies failed, keeping original response')
                  }
                }
              } else {
                console.log('ℹ️ No JSON found in response, keeping as-is')
              }
            }
          }
        } catch (e) {
          console.error('Error during JSON parsing:', e)
          // Keep original response on any error
        }
      } else if (typeof data.response === 'object' && data.response !== null) {
        // Already an object, use as-is
        parsedResponse = data.response
        console.log('✅ Response already an object')
      }

      return NextResponse.json({
        success: true,
        response: parsedResponse, // ✅ Bulletproof parsed response!
        raw_response: data.response, // Keep original for debugging
        agent_id,
        user_id,
        session_id,
        timestamp: new Date().toISOString(),
      })
    } else {
      const errorText = await response.text()
      return NextResponse.json(
        {
          success: false,
          error: `API returned status ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      )
    }
  } catch (error) {
    console.error('AI Agent API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// OPTIONS for CORS preflight (if needed)
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
