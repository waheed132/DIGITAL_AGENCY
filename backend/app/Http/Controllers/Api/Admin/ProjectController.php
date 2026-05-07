<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AgencyService;
use App\Models\Project;
use App\Models\User;
use App\Support\ServiceUnitSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProjectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Project::query()->with(['client', 'members'])->orderByDesc('created_at');

        if ($request->filled('client_id')) {
            $query->where('client_id', $request->integer('client_id'));
        }

        return response()->json($query->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'max:32'],
            'priority' => ['nullable', 'string', 'max:32'],
            'deadline' => ['nullable', 'date'],
        ]);

        $project = Project::query()->create($data);

        return response()->json($project->load(['client', 'members']), 201);
    }

    public function show(Project $project): JsonResponse
    {
        return response()->json($project->load(['client', 'members', 'tasks.assignee', 'agencyServices']));
    }

    public function update(Request $request, Project $project): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['sometimes', 'exists:clients,id'],
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'max:32'],
            'priority' => ['nullable', 'string', 'max:32'],
            'deadline' => ['nullable', 'date'],
        ]);

        $project->update($data);

        return response()->json($project->fresh()->load(['client', 'members']));
    }

    public function destroy(Project $project): JsonResponse
    {
        $project->delete();

        return response()->json(null, 204);
    }

    public function syncMembers(Request $request, Project $project): JsonResponse
    {
        $data = $request->validate([
            'user_ids' => ['required', 'array'],
            'user_ids.*' => [
                'integer',
                Rule::exists('users', 'id')->where(function ($query): void {
                    $query->where('role', User::ROLE_EMPLOYEE)
                        ->where('is_active', true);
                }),
            ],
        ]);

        $project->members()->sync($data['user_ids']);

        return response()->json($project->load('members'));
    }

    public function finalizePlan(Request $request, Project $project): JsonResponse
    {
        [$createdTasks, $createdDeliverables] = DB::transaction(function () use ($project): array {
            $tasks = 0;
            $deliverables = 0;
            $services = AgencyService::query()->where('project_id', $project->id)->orderBy('id')->get();

            foreach ($services as $service) {
                $sync = ServiceUnitSync::sync($service);
                $tasks += (int) ($sync['created'] ?? 0);
                $deliverables += (int) ($sync['created_deliverables'] ?? 0);
            }

            $project->update(['services_plan_locked' => true]);

            return [$tasks, $deliverables];
        });

        return response()->json([
            'ok' => true,
            'created_tasks' => $createdTasks,
            'created_deliverables' => $createdDeliverables,
            'project' => $project->fresh()->load(['client', 'members', 'tasks.assignee', 'agencyServices']),
        ]);
    }
}
