<?php

use App\Http\Controllers\Api\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\Admin\TaskAttachmentController as AdminTaskAttachmentController;
use App\Http\Controllers\Api\Admin\ClientController as AdminClientController;
use App\Http\Controllers\Api\Admin\ProjectController as AdminProjectController;
use App\Http\Controllers\Api\Admin\TaskController as AdminTaskController;
use App\Http\Controllers\Api\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\Admin\ClientAssetController as AdminClientAssetController;
use App\Http\Controllers\Api\Admin\ClientIntakeController as AdminClientIntakeController;
use App\Http\Controllers\Api\Admin\AgencyServiceController;
use App\Http\Controllers\Api\Admin\InvoiceController as AdminInvoiceController;
use App\Http\Controllers\Api\Admin\ActivityFeedController;
use App\Http\Controllers\Api\Admin\ApprovalQueueController;
use App\Http\Controllers\Api\Admin\AssetLibraryController;
use App\Http\Controllers\Api\Admin\CalendarController;
use App\Http\Controllers\Api\Admin\ClientIntakeInviteController as AdminClientIntakeInviteController;
use App\Http\Controllers\Api\Admin\DeliverableController;
use App\Http\Controllers\Api\Admin\WorkloadController;
use App\Http\Controllers\Api\Admin\OfficeExpenseAdvanceController;
use App\Http\Controllers\Api\Admin\OfficeExpenseController;
use App\Http\Controllers\Api\AttachmentAccessController;
use App\Http\Controllers\Api\ClientFileAccessController;
use App\Http\Controllers\Api\PublicClientIntakeController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Client\ClientPortalController;
use App\Http\Controllers\Api\Team\TaskAttachmentController as TeamTaskAttachmentController;
use App\Http\Controllers\Api\Team\TaskController as TeamTaskController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['status' => 'ok', 'app' => config('app.name')]);

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1');

Route::middleware('throttle:60,1')->group(function (): void {
    Route::get('/public/client-intake/{token}', [PublicClientIntakeController::class, 'show']);
});
Route::middleware('throttle:15,1')->group(function (): void {
    Route::post('/public/client-intake/{token}', [PublicClientIntakeController::class, 'submit']);
});

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/user', [AuthController::class, 'user']);
    Route::get('/attachments/{attachment}', [AttachmentAccessController::class, 'show']);
    Route::get('/client-files/{client}/{kind}', [ClientFileAccessController::class, 'show'])
        ->where('kind', 'logo|business-profile');
});

Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function (): void {
    Route::get('dashboard/stats', [AdminDashboardController::class, 'stats']);
    Route::get('client-intakes', [AdminClientIntakeController::class, 'index']);
    Route::post('client-intakes', [AdminClientIntakeController::class, 'store']);
    Route::get('client-intakes/{clientIntake}', [AdminClientIntakeController::class, 'show']);
    Route::post('client-intakes/{clientIntake}/reject', [AdminClientIntakeController::class, 'reject']);
    Route::post('client-intakes/{clientIntake}/approve', [AdminClientIntakeController::class, 'approve']);
    Route::get('client-intake-invites', [AdminClientIntakeInviteController::class, 'index']);
    Route::post('client-intake-invites', [AdminClientIntakeInviteController::class, 'store']);
    Route::delete('client-intake-invites/{clientIntakeInvite}', [AdminClientIntakeInviteController::class, 'destroy']);

    Route::get('agency-services', [AgencyServiceController::class, 'index']);
    Route::post('agency-services', [AgencyServiceController::class, 'store']);
    Route::get('agency-services/{agencyService}/units', [AgencyServiceController::class, 'units']);
    Route::post('agency-services/{agencyService}/backfill-assignees', [AgencyServiceController::class, 'backfillAssignees']);
    Route::post('agency-services/{agencyService}/assign-tasks', [AgencyServiceController::class, 'assignUnassignedTasks']);
    Route::patch('agency-services/{agencyService}', [AgencyServiceController::class, 'update']);
    Route::delete('agency-services/{agencyService}', [AgencyServiceController::class, 'destroy']);
    Route::post('agency-services/{agencyService}/invoices/generate', [AdminInvoiceController::class, 'generateForService']);

    Route::get('invoices/{invoice}', [AdminInvoiceController::class, 'show']);
    Route::get('invoices/{invoice}/pdf', [AdminInvoiceController::class, 'downloadPdf']);
    Route::patch('invoices/{invoice}', [AdminInvoiceController::class, 'update']);
    Route::post('invoices/{invoice}/send', [AdminInvoiceController::class, 'sendToClient']);

    Route::get('deliverables', [DeliverableController::class, 'index']);
    Route::post('deliverables', [DeliverableController::class, 'store']);
    Route::patch('deliverables/{deliverable}', [DeliverableController::class, 'update']);
    Route::delete('deliverables/{deliverable}', [DeliverableController::class, 'destroy']);

    Route::get('approvals', [ApprovalQueueController::class, 'index']);
    Route::post('approvals/{task}/approve', [ApprovalQueueController::class, 'approve']);
    Route::post('approvals/{task}/revision', [ApprovalQueueController::class, 'requestRevision']);
    Route::post('approvals/{task}/return-to-doing', [ApprovalQueueController::class, 'returnToDoing']);

    Route::get('activity', [ActivityFeedController::class, 'index']);
    Route::get('workload', [WorkloadController::class, 'index']);
    Route::get('calendar/tasks', [CalendarController::class, 'tasks']);
    Route::get('assets', [AssetLibraryController::class, 'index']);

    Route::apiResource('office-expenses', OfficeExpenseController::class)->except(['show']);
    Route::post('office-expense-advances', [OfficeExpenseAdvanceController::class, 'store']);

    Route::apiResource('clients', AdminClientController::class);
    Route::post('clients/{client}/logo', [AdminClientAssetController::class, 'storeLogo']);
    Route::delete('clients/{client}/logo', [AdminClientAssetController::class, 'destroyLogo']);
    Route::post('clients/{client}/business-profile', [AdminClientAssetController::class, 'storeBusinessProfile']);
    Route::delete('clients/{client}/business-profile', [AdminClientAssetController::class, 'destroyBusinessProfile']);
    Route::get('projects/{project}/invoice-status', [AdminInvoiceController::class, 'projectFullInvoiceStatus']);
    Route::post('projects/{project}/invoices/generate-full', [AdminInvoiceController::class, 'generateFullForProject']);
    Route::apiResource('projects', AdminProjectController::class);
    Route::post('projects/{project}/members', [AdminProjectController::class, 'syncMembers']);
    Route::post('projects/{project}/finalize-plan', [AdminProjectController::class, 'finalizePlan']);
    Route::apiResource('tasks', AdminTaskController::class);
    Route::post('tasks/{task}/attachments', [AdminTaskAttachmentController::class, 'store']);
    Route::delete('tasks/{task}/attachments/{attachment}', [AdminTaskAttachmentController::class, 'destroy']);
    Route::apiResource('users', AdminUserController::class);
});

Route::middleware(['auth:sanctum', 'client'])->prefix('client')->group(function (): void {
    Route::get('dashboard', [ClientPortalController::class, 'dashboard']);
    Route::get('projects', [ClientPortalController::class, 'projects']);
    Route::get('projects/{project}', [ClientPortalController::class, 'project']);
    Route::get('notifications', [ClientPortalController::class, 'notifications']);
    Route::get('invoices/{invoice}/pdf', [ClientPortalController::class, 'invoicePdf']);
});

Route::middleware('auth:sanctum')->prefix('team')->group(function (): void {
    Route::get('analytics', [TeamTaskController::class, 'analytics']);
    Route::get('activity', [TeamTaskController::class, 'activity']);
    Route::get('tasks', [TeamTaskController::class, 'index']);
    Route::get('projects', [TeamTaskController::class, 'projects']);
    Route::patch('tasks/{task}', [TeamTaskController::class, 'update']);
    Route::post('tasks/{task}/attachments', [TeamTaskAttachmentController::class, 'store']);
    Route::delete('tasks/{task}/attachments/{attachment}', [TeamTaskAttachmentController::class, 'destroy']);
});

