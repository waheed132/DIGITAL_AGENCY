@php
    /** @var \App\Models\Invoice $invoice */
@endphp
<p>Hello {{ $invoice->client_name ?? 'there' }},</p>
<p>Please find your invoice <strong>{{ $invoice->invoice_number }}</strong> attached (PDF).</p>
<p>Total: <strong>{{ $invoice->currency }} {{ number_format((float) $invoice->amount, 0) }}</strong></p>
@if($invoice->due_date)
    <p>Due date: {{ $invoice->due_date->format('M j, Y') }}</p>
@endif
<p>— {{ config('invoices.agency_name', config('app.name')) }}</p>
