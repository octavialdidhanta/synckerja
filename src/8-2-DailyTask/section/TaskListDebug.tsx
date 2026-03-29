import React, { useState } from 'react';
import { useDailyTask } from '../DailyTaskContext';

export const TaskListDebug = () => {
  const { tasks, addTask, addTaskStep } = useDailyTask();
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleAddTask = async () => {
    if (newTaskTitle.trim()) {
      await addTask({
        title: newTaskTitle,
        description: 'Test task',
        priority: 'medium',
        status: 'pending'
      });
      setNewTaskTitle('');
    }
  };

  const handleAddStep = async (taskId: string) => {
    const stepTitle = prompt('Enter step title:');
    if (stepTitle) {
      await addTaskStep(taskId, stepTitle);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Debug Task List</h2>
      
      {/* Add Task Form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Enter task title"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
        />
        <button
          onClick={handleAddTask}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Add Task
        </button>
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="p-3 border border-gray-200 rounded-md">
            <h3 className="font-medium">{task.title}</h3>
            <p className="text-sm text-gray-600">Status: {task.status}</p>
            <p className="text-sm text-gray-600">Progress: {task.progress_percentage}%</p>
            <p className="text-sm text-gray-600">Steps: {task.steps.length}</p>
            <p className="text-sm text-gray-600">Files: {task.files.length}</p>
            
            <button
              onClick={() => handleAddStep(task.id)}
              className="mt-2 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Add Step
            </button>
            
            {/* Steps List */}
            {task.steps.length > 0 && (
              <div className="mt-2 ml-4">
                <h4 className="text-sm font-medium">Steps:</h4>
                {task.steps.map((step) => (
                  <div key={step.id} className="text-sm text-gray-600">
                    - {step.title} ({step.is_completed ? 'Completed' : 'Pending'})
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
