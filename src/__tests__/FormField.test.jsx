import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FormField, { FormActions } from '../components/FormField.jsx'
import { Form } from 'react-bootstrap'

describe('FormField', () => {
  it('renders label and children', () => {
    render(
      <FormField label="Plant name" htmlFor="pname">
        <Form.Control id="pname" defaultValue="" />
      </FormField>,
    )
    expect(screen.getByText('Plant name')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders required indicator when required=true', () => {
    render(
      <FormField label="Species" htmlFor="species" required>
        <Form.Control id="species" />
      </FormField>,
    )
    expect(screen.getByLabelText('required')).toBeInTheDocument()
  })

  it('renders inline error when error prop is set', () => {
    render(
      <FormField label="Name" error="Name is required">
        <Form.Control />
      </FormField>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required')
  })

  it('renders help text when no error', () => {
    render(
      <FormField label="Notes" help="Optional extra info">
        <Form.Control as="textarea" />
      </FormField>,
    )
    expect(screen.getByText('Optional extra info')).toBeInTheDocument()
  })

  it('hides help text when there is an error', () => {
    render(
      <FormField label="Notes" help="Optional extra info" error="Too long">
        <Form.Control as="textarea" />
      </FormField>,
    )
    expect(screen.queryByText('Optional extra info')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('Too long')
  })
})

describe('FormActions', () => {
  it('renders submit button with custom label', () => {
    render(<FormActions submitLabel="Create plant" />)
    expect(screen.getByRole('button', { name: /create plant/i })).toBeInTheDocument()
  })

  it('renders cancel button when onCancel provided', () => {
    render(<FormActions onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('disables submit when loading=true', () => {
    render(<FormActions loading />)
    const btn = screen.getByRole('button', { name: /save/i })
    expect(btn).toBeDisabled()
  })
})
