<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Mail\InvoiceSentMail;
use App\Models\AgencyService;
use App\Models\Invoice;
use App\Models\Project;
use App\Services\InvoiceDocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class InvoiceController extends Controller
{
    public function __construct(
        private readonly InvoiceDocumentService $documents
    ) {}

    public function generateForService(AgencyService $agencyService): JsonResponse
    {
        $existing = Invoice::query()
            ->where('invoice_key', 'p'.$agencyService->project_id.'-s'.$agencyService->id)
            ->first();
        if ($existing && $existing->status === Invoice::STATUS_PAID) {
            return response()->json(['message' => 'Invoice is marked paid. Unmark paid before regenerating.'], 422);
        }

        $invoice = $this->documents->syncServiceInvoice($agencyService->load('project'));

        return response()->json($invoice->toApiArray());
    }

    public function generateFullForProject(Project $project): JsonResponse
    {
        $existing = Invoice::query()
            ->where('invoice_key', 'p'.$project->id.'-full')
            ->first();
        if ($existing && $existing->status === Invoice::STATUS_PAID) {
            return response()->json(['message' => 'Project invoice is marked paid. Unmark paid before regenerating.'], 422);
        }

        $invoice = $this->documents->syncProjectFullInvoice($project);

        return response()->json($invoice->toApiArray());
    }

    public function show(Invoice $invoice): JsonResponse
    {
        return response()->json($invoice->toApiArray());
    }

    public function downloadPdf(Invoice $invoice): StreamedResponse|\Illuminate\Http\Response
    {
        if (! $invoice->pdf_path || ! Storage::disk('local')->exists($invoice->pdf_path)) {
            $this->documents->writePdf($invoice->fresh());
            $invoice->refresh();
        }

        $name = 'invoice-'.$invoice->invoice_number.'.pdf';

        return Storage::disk('local')->download($invoice->pdf_path, $name);
    }

    public function update(Request $request, Invoice $invoice): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', 'string', 'in:draft,sent,paid'],
            'due_date' => ['nullable', 'date'],
            'footer_notes' => ['nullable', 'string', 'max:2000'],
        ]);
        if (isset($data['status'])) {
            if ($data['status'] === Invoice::STATUS_SENT) {
                $data['sent_at'] = $invoice->sent_at ?? now();
            }
            if ($data['status'] === Invoice::STATUS_PAID) {
                $data['paid_at'] = $invoice->paid_at ?? now();
            }
            if ($data['status'] !== Invoice::STATUS_PAID) {
                $data['paid_at'] = null;
            }
        }
        $invoice->update($data);

        return response()->json($invoice->fresh()->toApiArray());
    }

    public function projectFullInvoiceStatus(Project $project): JsonResponse
    {
        $inv = Invoice::query()
            ->where('project_id', $project->id)
            ->where('scope', Invoice::SCOPE_PROJECT)
            ->first();

        return response()->json([
            'project_invoice' => $inv?->toApiArray(),
        ]);
    }

    public function sendToClient(Invoice $invoice): JsonResponse
    {
        $invoice->load('project.client');
        $email = $invoice->client_email ?: $invoice->project?->client?->email;
        if (! $email) {
            return response()->json(['message' => 'Client has no email. Add an email on the client record first.'], 422);
        }
        if (! $invoice->pdf_path || ! Storage::disk('local')->exists($invoice->pdf_path)) {
            $this->documents->writePdf($invoice->fresh());
            $invoice->refresh();
        }

        $absolute = Storage::disk('local')->path($invoice->pdf_path);
        Mail::to($email)->send(new InvoiceSentMail($invoice, $absolute));

        $invoice->update([
            'status' => Invoice::STATUS_SENT,
            'client_email' => $email,
            'sent_at' => now(),
        ]);

        return response()->json($invoice->fresh()->toApiArray());
    }
}
