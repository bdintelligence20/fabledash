// Helper functions for formatting data

// Helper function to format client data
function formatClient(client) {
  return {
    id: client.id,
    name: client.name,
    contact_email: client.contact_email,
    contact_phone: client.contact_phone,
    notes: client.notes,
    created_at: client.created_at,
    updated_at: client.updated_at
  };
}

// Helper function to format task data
function formatTask(task) {
  return {
    id: task.id,
    client_id: task.client_id,
    title: task.title,
    description: task.description,
    status_id: task.status_id,
    start_date: task.start_date,
    due_date: task.due_date,
    is_recurring: Boolean(task.is_recurring),
    recurrence_pattern: task.recurrence_pattern || null,
    priority: task.priority,
    created_at: task.created_at,
    updated_at: task.updated_at
  };
}

module.exports = {
  formatClient,
  formatTask
};
