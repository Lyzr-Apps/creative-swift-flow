'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Send, MessageSquare, CheckCircle, AlertTriangle, Ticket, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Message {
  id: string
  type: 'user' | 'agent'
  content: string
  timestamp: string
  status?: string
  confidence?: number
  sources?: string[]
  suggestedAction?: string
  processingTime?: string
}

interface TicketForm {
  name: string
  email: string
  subject: string
  message: string
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionId] = useState(`session-${Date.now()}`)
  const [showTicketDialog, setShowTicketDialog] = useState(false)
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketSuccess, setTicketSuccess] = useState('')
  const [ticketError, setTicketError] = useState('')
  const [ticketForm, setTicketForm] = useState<TicketForm>({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setError('')
    setLoading(true)

    try {
      // Call the agent API
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          agent_id: '690ddd00fef1b728eed3206a',
          session_id: sessionId,
          conversation_history: messages.map((m) => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        }),
      })

      const data = await response.json()

      if (data.success) {
        const agentResponse = data.response
        const agentMessage: Message = {
          id: `msg-${Date.now()}-agent`,
          type: 'agent',
          content:
            typeof agentResponse === 'string'
              ? agentResponse
              : agentResponse?.response || 'No response received',
          timestamp: new Date().toLocaleTimeString(),
          status:
            agentResponse?.status ||
            (typeof agentResponse === 'object' ? agentResponse.status : 'success'),
          confidence: agentResponse?.confidence,
          sources: agentResponse?.sources_used,
          suggestedAction: agentResponse?.suggested_action,
          processingTime: agentResponse?.metadata?.processing_time || data.timestamp,
        }
        setMessages((prev) => [...prev, agentMessage])
      } else {
        setError(
          data.error || 'Failed to get response from the agent. Please try again.'
        )
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred. Please check the API key and try again.'
      )
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'escalation_recommended':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />
      default:
        return <MessageSquare className="w-4 h-4 text-blue-600" />
    }
  }

  async function handleTicketSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ticketForm.name || !ticketForm.email || !ticketForm.subject || !ticketForm.message) {
      setTicketError('All fields are required')
      return
    }

    setTicketLoading(true)
    setTicketError('')
    setTicketSuccess('')

    try {
      const ticketId = `TICKET-${Date.now()}`

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: ticketForm.name,
          customerEmail: ticketForm.email,
          subject: ticketForm.subject,
          customerMessage: ticketForm.message,
          ticketId: ticketId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setTicketSuccess(`Ticket created successfully! Your ticket ID: ${ticketId}`)
        setTicketForm({ name: '', email: '', subject: '', message: '' })
        setTimeout(() => {
          setShowTicketDialog(false)
          setTicketSuccess('')
        }, 2000)
      } else {
        setTicketError(data.error || 'Failed to create ticket')
      }
    } catch (err) {
      setTicketError(
        err instanceof Error ? err.message : 'An error occurred while creating the ticket'
      )
      console.error('Error:', err)
    } finally {
      setTicketLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 rounded-t-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-blue-600" />
                Customer Support
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Ask questions about our products and services
              </p>
            </div>
            <Button
              onClick={() => {
                setShowTicketDialog(true)
                setTicketError('')
                setTicketSuccess('')
              }}
              className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
            >
              <Ticket className="w-4 h-4 mr-2" />
              Create Ticket
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-4 mt-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto bg-white p-4 space-y-4 mx-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Start a Conversation
                </h2>
                <p className="text-gray-600">
                  Ask any questions about our products or services
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-md px-4 py-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>

                  {/* Agent Message Metadata */}
                  {message.type === 'agent' && (
                    <div className="mt-3 space-y-2 text-xs border-t border-gray-300 pt-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(message.status)}
                        <span className="text-gray-600">
                          {message.status === 'escalation_recommended'
                            ? 'Escalation Recommended'
                            : 'Response Generated'}
                        </span>
                      </div>

                      {message.confidence !== undefined && (
                        <div>
                          <span className="text-gray-600">Confidence: </span>
                          <Badge
                            variant={
                              message.confidence > 0.8
                                ? 'default'
                                : message.confidence > 0.5
                                  ? 'secondary'
                                  : 'destructive'
                            }
                            className="ml-1"
                          >
                            {(message.confidence * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      )}

                      {message.sources && message.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {message.sources.map((source) => (
                            <Badge key={source} variant="outline" className="text-xs">
                              {source}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {message.suggestedAction &&
                        message.suggestedAction !== 'none' && (
                          <div className="text-amber-700 bg-amber-50 p-2 rounded">
                            Action: {message.suggestedAction}
                          </div>
                        )}

                      {message.processingTime && (
                        <div className="text-gray-500">
                          Processed in {message.processingTime}
                        </div>
                      )}
                    </div>
                  )}

                  {/* User Timestamp */}
                  {message.type === 'user' && (
                    <p className="text-xs mt-1 opacity-70">{message.timestamp}</p>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border-t border-gray-200 rounded-b-lg p-4 mx-4 mb-4 shadow-sm"
        >
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <div className="animate-spin">
                  <Send className="w-4 h-4" />
                </div>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>

        {/* Ticket Creation Dialog */}
        <Dialog open={showTicketDialog} onOpenChange={setShowTicketDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-green-600" />
                Create Support Ticket
              </DialogTitle>
              <DialogDescription>
                Submit a detailed ticket and we'll notify your support team immediately
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleTicketSubmit} className="space-y-4">
              {/* Success Message */}
              {ticketSuccess && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {ticketSuccess}
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Message */}
              {ticketError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{ticketError}</AlertDescription>
                </Alert>
              )}

              {/* Name Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Your Name</label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={ticketForm.name}
                  onChange={(e) =>
                    setTicketForm({ ...ticketForm, name: e.target.value })
                  }
                  disabled={ticketLoading}
                  className="w-full"
                />
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email Address</label>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  value={ticketForm.email}
                  onChange={(e) =>
                    setTicketForm({ ...ticketForm, email: e.target.value })
                  }
                  disabled={ticketLoading}
                  className="w-full"
                />
              </div>

              {/* Subject Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Subject</label>
                <Input
                  type="text"
                  placeholder="Brief description of your issue"
                  value={ticketForm.subject}
                  onChange={(e) =>
                    setTicketForm({ ...ticketForm, subject: e.target.value })
                  }
                  disabled={ticketLoading}
                  className="w-full"
                />
              </div>

              {/* Message Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Detailed Message
                </label>
                <textarea
                  placeholder="Please provide detailed information about your issue..."
                  value={ticketForm.message}
                  onChange={(e) =>
                    setTicketForm({ ...ticketForm, message: e.target.value })
                  }
                  disabled={ticketLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={4}
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTicketDialog(false)}
                  disabled={ticketLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={ticketLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {ticketLoading ? (
                    <div className="animate-spin">
                      <Send className="w-4 h-4" />
                    </div>
                  ) : (
                    <>
                      <Ticket className="w-4 h-4 mr-2" />
                      Submit Ticket
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
