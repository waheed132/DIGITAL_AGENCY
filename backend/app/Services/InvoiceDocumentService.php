<?php

namespace App\Services;

use App\Models\AgencyService;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class InvoiceDocumentService
{
    public function syncServiceInvoice(AgencyService $service): Invoice
    {
        $service->load(['project.client']);
        $project = $service->project;
        if (! $project) {
            abort(404, 'Project not found for this service.');
        }

        $planned = (int) ($service->planned_quantity ?? 0);
        $unitPrice = (float) ($service->unit_price ?? 0);
        $done = $this->completedDeliverableUnits($service);
        $billUnits = $planned > 0 ? min($planned, $done) : 0;
        $lineTotal = round($billUnits * $unitPrice, 2);
        $lineItems = [
            [
                'service' => $service->name,
                'description' => $planned > 0 ? "{$billUnits} × PKR ".number_format($unitPrice, 0).' / deliverable' : 'Completed deliverables × unit price',
                'quantity' => $billUnits,
                'unit_pkr' => $unitPrice,
                'line_pkr' => $lineTotal,
            ],
        ];

        $client = $project->client;
        $key = 'p'.$project->id.'-s'.$service->id;
        $agencyName = (string) config('invoices.agency_name', config('app.name'));
        $dueDays = (int) config('invoices.default_due_days', 14);

        return DB::transaction(function () use ($key, $service, $project, $lineItems, $lineTotal, $client, $agencyName, $dueDays): Invoice {
            $inv = Invoice::query()->updateOrCreate(
                ['invoice_key' => $key],
                [
                    'project_id' => $project->id,
                    'agency_service_id' => $service->id,
                    'scope' => Invoice::SCOPE_SERVICE,
                    'status' => Invoice::STATUS_DRAFT,
                    'sent_at' => null,
                    'paid_at' => null,
                    'amount' => $lineTotal,
                    'currency' => 'PKR',
                    'line_items' => $lineItems,
                    'client_name' => $client?->name,
                    'client_email' => $client?->email,
                    'agency_name' => $agencyName,
                    'footer_notes' => (string) config('invoices.payment_notes', ''),
                    'due_date' => now()->addDays($dueDays)->toDateString(),
                ]
            );
            if (! $inv->invoice_number) {
                $inv->update(['invoice_number' => 'FP-'.str_pad((string) $inv->id, 6, '0', STR_PAD_LEFT)]);
            }
            $this->writePdf($inv->fresh());

            return $inv->fresh();
        });
    }

    public function syncProjectFullInvoice(Project $project): Invoice
    {
        $project->load(['client', 'agencyServices']);
        $key = 'p'.$project->id.'-full';
        $agencyName = (string) config('invoices.agency_name', config('app.name'));
        $dueDays = (int) config('invoices.default_due_days', 14);

        $lineItems = [];
        $total = 0.0;
        foreach ($project->agencyServices as $svc) {
            $planned = (int) ($svc->planned_quantity ?? 0);
            $unitPrice = (float) ($svc->unit_price ?? 0);
            $done = $this->completedDeliverableUnits($svc);
            $billUnits = $planned > 0 ? min($planned, $done) : 0;
            $line = round($billUnits * $unitPrice, 2);
            $total += $line;
            $lineItems[] = [
                'service' => $svc->name,
                'description' => $planned > 0 ? "{$billUnits} × PKR ".number_format($unitPrice, 0).' / deliverable' : 'Completed deliverables × unit price',
                'quantity' => $billUnits,
                'unit_pkr' => $unitPrice,
                'line_pkr' => $line,
            ];
        }

        $client = $project->client;

        return DB::transaction(function () use ($key, $project, $lineItems, $total, $client, $agencyName, $dueDays): Invoice {
            $inv = Invoice::query()->updateOrCreate(
                ['invoice_key' => $key],
                [
                    'project_id' => $project->id,
                    'agency_service_id' => null,
                    'scope' => Invoice::SCOPE_PROJECT,
                    'status' => Invoice::STATUS_DRAFT,
                    'sent_at' => null,
                    'paid_at' => null,
                    'amount' => round($total, 2),
                    'currency' => 'PKR',
                    'line_items' => $lineItems,
                    'client_name' => $client?->name,
                    'client_email' => $client?->email,
                    'agency_name' => $agencyName,
                    'footer_notes' => (string) config('invoices.payment_notes', ''),
                    'due_date' => now()->addDays($dueDays)->toDateString(),
                ]
            );
            if (! $inv->invoice_number) {
                $inv->update(['invoice_number' => 'FP-'.str_pad((string) $inv->id, 6, '0', STR_PAD_LEFT)]);
            }
            $this->writePdf($inv->fresh());

            return $inv->fresh();
        });
    }

    /** Bill completed outputs (deliverables whose workflow tasks are all done). Legacy: tasks without deliverables still count as units when none exist. */
    private function completedDeliverableUnits(AgencyService $service): int
    {
        if (! Schema::hasColumn('tasks', 'deliverable_id')) {
            return (int) Task::query()
                ->where('project_id', $service->project_id)
                ->where('service_id', $service->id)
                ->where('status', 'done')
                ->count();
        }

        $complete = (int) $service->deliverables()
            ->whereHas('tasks')
            ->whereDoesntHave('tasks', fn (Builder $t) => $t->where('status', '!=', 'done'))
            ->count();

        if ($complete > 0 || $service->deliverables()->exists()) {
            return $complete;
        }

        return (int) Task::query()
            ->where('project_id', $service->project_id)
            ->where('service_id', $service->id)
            ->whereNull('deliverable_id')
            ->where('status', 'done')
            ->count();
    }

    public function writePdf(Invoice $invoice): void
    {
        $invoice->load(['project', 'agencyService']);
        $pdf = Pdf::loadView('invoices.pdf', ['invoice' => $invoice]);
        $path = 'invoices/invoice-'.$invoice->id.'.pdf';
        Storage::disk('local')->put($path, $pdf->output());
        $invoice->update(['pdf_path' => $path]);
    }
}
