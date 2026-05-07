<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Invoice {{ $invoice->invoice_number }}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: DejaVu Sans, sans-serif; color: #0f172a; font-size: 11px; margin: 0; padding: 32px; }
    .header { display: table; width: 100%; margin-bottom: 24px; border-bottom: 2px solid #10b981; padding-bottom: 12px; }
    .header-left, .header-right { display: table-cell; vertical-align: top; }
    .header-right { text-align: right; }
    h1 { margin: 0 0 4px; font-size: 20px; color: #0f172a; }
    .muted { color: #64748b; margin: 0; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { text-align: left; background: #ecfdf5; color: #065f46; padding: 8px 6px; border: 1px solid #a7f3d0; font-size: 10px; text-transform: uppercase; }
    td { padding: 8px 6px; border: 1px solid #e2e8f0; }
    .num { text-align: right; }
    .totals { margin-top: 12px; text-align: right; }
    .totals strong { font-size: 14px; color: #047857; }
    .foot { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #475569; font-size: 9px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>{{ $invoice->agency_name ?? config('app.name') }}</h1>
      <p class="muted">{{ config('invoices.agency_tagline') }}</p>
    </div>
    <div class="header-right">
      <h1 style="color:#10b981;">INVOICE</h1>
      <p class="muted" style="margin:0"><strong>Invoice #</strong> {{ $invoice->invoice_number }}</p>
      <p class="muted" style="margin:4px 0 0"><strong>Date</strong> {{ $invoice->created_at?->format('M d, Y') }}</p>
      @if($invoice->due_date)
      <p class="muted" style="margin:4px 0 0"><strong>Due</strong> {{ $invoice->due_date->format('M d, Y') }}</p>
      @endif
    </div>
  </div>

  <div class="box">
    <strong>Bill to</strong>
    <p class="muted" style="margin:4px 0 0">
      {{ $invoice->client_name ?? 'Client' }}<br>
      @if($invoice->client_email){{ $invoice->client_email }}<br>@endif
      <span style="color:#94a3b8;">Project: {{ $invoice->project?->name ?? '—' }}</span>
    </p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Service / description</th>
        <th class="num">Qty</th>
        <th class="num">Unit ({{ $invoice->currency }})</th>
        <th class="num">Line ({{ $invoice->currency }})</th>
      </tr>
    </thead>
    <tbody>
      @foreach($invoice->line_items as $row)
      <tr>
        <td>
          <strong>{{ $row['service'] ?? '—' }}</strong><br>
          <span style="color:#64748b;font-size:9px;">{{ $row['description'] ?? '' }}</span>
        </td>
        <td class="num">{{ $row['quantity'] ?? 0 }}</td>
        <td class="num">{{ number_format((float)($row['unit_pkr'] ?? 0), 0) }}</td>
        <td class="num">{{ number_format((float)($row['line_pkr'] ?? 0), 0) }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>

  <div class="totals">
    <p><strong>Total due: {{ $invoice->currency }} {{ number_format((float) $invoice->amount, 0) }}</strong></p>
  </div>

  <div class="foot">
    <p><strong>Payment &amp; notes</strong></p>
    <p>{!! nl2br(e($invoice->footer_notes ?? config('invoices.payment_notes'))) !!}</p>
  </div>
</body>
</html>
