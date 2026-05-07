<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #0f172a;">
<p>Hi @if($invoice->client_name){{ $invoice->client_name }}@else there@endif,</p>
<p>Please find your invoice <strong>{{ $invoice->invoice_number }}</strong> attached (PDF).</p>
<p><strong>Amount due:</strong> {{ $invoice->currency }} {{ number_format((float) $invoice->amount, 2) }}</p>
@if($invoice->due_date)
<p><strong>Due date:</strong> {{ $invoice->due_date->format('M j, Y') }}</p>
@endif
<p>Thank you,<br>{{ config('invoices.agency_name', config('app.name')) }}</p>
</body>
</html>
