import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  FiArrowLeft, FiPlay, FiSquare, FiClock, FiUser, 
  FiCalendar, FiMessageSquare, FiSend, FiStar
} from 'react-icons/fi';
import { tasksAPI, ratingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './TaskDetails.css';

const TaskDetails = () => {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [comments, setComments] = useState([]);
  const [timers, setTimers] = useState([]);
  const [totalTime, setTotalTime] = useState(0);
  const [activeTimer, setActiveTimer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [progress, setProgress] = useState(0);
  const [taskRatings, setTaskRatings] = useState([]);
  const { user, isEmployee } = useAuth();

  useEffect(() => {
    fetchTaskDetails();
  }, [id]);

  useEffect(() => {
    // Find active timer
    const active = timers.find(t => !t.end_time && t.user_id === user?.id);
    setActiveTimer(active);
  }, [timers, user]);

  const fetchTaskDetails = async () => {
    try {
      const response = await tasksAPI.getDetails(id);
      setTask(response.data.task);
      setSubtasks(response.data.subtasks);
      setComments(response.data.comments);
      setTimers(response.data.timers);
      setTotalTime(response.data.total_time_seconds);
      setProgress(response.data.task.percent_complete);
      setTaskRatings(response.data.ratings || []);
    } catch (error) {
      console.error('Error fetching task:', error);
      toast.error('Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTimer = async () => {
    try {
      const response = await tasksAPI.startTimer(id);
      setActiveTimer(response.data);
      toast.success('Timer started');
      fetchTaskDetails();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start timer');
    }
  };

  const handleStopTimer = async () => {
  if (!activeTimer) return;

  try {
    // Optional: pass stop notes
    await tasksAPI.stopTimer(activeTimer.id, "Completed task"); // or prompt user
    // Or just: await tasksAPI.stopTimer(activeTimer.id);

    setActiveTimer(null);
    toast.success('Timer stopped');
    fetchTaskDetails();
  } catch (error) {
    toast.error(
      error.response?.data?.detail || 'Failed to stop timer'
    );
  }
};

  const handleStatusChange = async (newStatus) => {
    try {
      await tasksAPI.update(id, { status: newStatus });
      toast.success('Status updated');
      fetchTaskDetails();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleProgressChange = async () => {
    try {
      await tasksAPI.update(id, { percent_complete: progress });
      toast.success('Progress updated');
      fetchTaskDetails();
    } catch (error) {
      toast.error('Failed to update progress');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    try {
      await tasksAPI.createComment(id, newComment);
      setNewComment('');
      toast.success('Comment added');
      fetchTaskDetails();
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'todo': return 'warning';
      case 'in-progress': return 'info';
      case 'blocked': return 'danger';
      case 'review': return 'primary';
      case 'done': return 'success';
      default: return 'primary';
    }
  };

  const isFullyDone = task?.status === 'done' && task?.percent_complete === 100;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading task...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="empty-state">
        <h3>Task not found</h3>
        <Link to="/tasks" className="btn btn-primary">Back to Tasks</Link>
      </div>
    );
  }

  return (
    <div className="task-details-page">
      <Link to="/tasks" className="back-link">
        <FiArrowLeft /> Back to Tasks
      </Link>

      <div className="task-header">
        <div className="task-info">
          <div className="task-badges">
            <span className={`badge badge-${getStatusColor(task.status)}`}>
              {task.status}
            </span>
            <span className={`badge badge-${task.priority === 'high' || task.priority === 'urgent' ? 'danger' : 'warning'}`}>
              {task.priority}
            </span>
          </div>
          <h1>{task.title}</h1>
          <p>{task.description || 'No description'}</p>
        </div>

        <div className="task-actions-panel">
          {isEmployee && (
            <>
              <select
                className="form-select"
                value={task.status}
                disabled={isFullyDone}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>

              <div className="timer-section">
                {activeTimer ? (
                  <button className="btn btn-danger" onClick={handleStopTimer} disabled={isFullyDone}>
                    <FiSquare /> Stop Timer
                  </button>
                ) : (
                  <button className="btn btn-success" onClick={handleStartTimer} disabled={isFullyDone}>
                    <FiPlay /> Start Timer
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="task-details-grid">
        {/* Left Column */}
        <div className="task-main">
          {/* Meta Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Details</h3>
            </div>
            <div className="task-meta-grid">
              <div className="meta-item">
                <FiUser />
                <div>
                  <span className="meta-label">Assigned To</span>
                  <span className="meta-value">{task.assigned_to_name || 'Unassigned'}</span>
                </div>
              </div>
              <div className="meta-item">
                <FiUser />
                <div>
                  <span className="meta-label">Assigned By</span>
                  <span className="meta-value">{task.assigned_by_name || '-'}</span>
                </div>
              </div>
              <div className="meta-item">
                <FiCalendar />
                <div>
                  <span className="meta-label">Start Date</span>
                  <span className="meta-value">
                    {task.start_date ? new Date(task.start_date).toLocaleDateString() : 'Not set'}
                  </span>
                </div>
              </div>
              <div className="meta-item">
                <FiCalendar />
                <div>
                  <span className="meta-label">Due Date</span>
                  <span className="meta-value">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Not set'}
                  </span>
                </div>
              </div>
              <div className="meta-item">
                <FiClock />
                <div>
                  <span className="meta-label">Time Spent</span>
                  <span className="meta-value">{formatTime(totalTime)}</span>
                </div>
              </div>
              {task.is_delayed && task.delayed_days > 0 && (
                <div className="meta-item">
                  <FiClock />
                  <div>
                    <span className="meta-label">Delayed</span>
                    <span className="meta-value danger">
                      {task.delayed_days} day{task.delayed_days !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Progress Slider */}
            <div className="progress-section">
              <div className="progress-header">
                <span>Progress: {progress}%</span>
                {isEmployee && !isFullyDone && (
                  <button className="btn btn-secondary btn-sm" onClick={handleProgressChange}>
                    Save
                  </button>
                )}
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value))}
                className="progress-slider"
                disabled={!isEmployee || isFullyDone}
              />
              <div className="progress-bar">
                <div 
                  className={`progress-bar-fill ${progress === 100 ? 'success' : 'primary'}`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Ratings */}
          <div className="card ratings-section">
            <div className="card-header">
              <h3 className="card-title">
                <FiStar /> Ratings ({taskRatings.length})
              </h3>
            </div>
            <div className="ratings-list">
              {taskRatings.length === 0 ? (
                <p className="no-comments">No ratings for this task yet</p>
              ) : (
                taskRatings.map((rating) => (
                  <div key={rating.id} className="rating-row">
                    <div className={`rating-score-badge ${rating.score >= 4 ? 'success' : rating.score >= 3 ? 'warning' : 'danger'}`}>
                      {rating.score}/5
                    </div>
                    <div className="rating-meta">
                      <strong>{rating.rater_name}</strong> rated {rating.ratee_name}
                      <div className="rating-date">
                        {new Date(rating.rated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="card comments-section">
            <div className="card-header">
              <h3 className="card-title">
                <FiMessageSquare /> Comments ({comments.length})
              </h3>
            </div>
            <div className="comments-list">
              {comments.length === 0 ? (
                <p className="no-comments">No comments yet</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="comment">
                    <div className="avatar avatar-sm">
                      {(comment.author_name || comment.user_name)?.charAt(0).toUpperCase()}
                    </div>
                    <div className="comment-content">
                      <div className="comment-header">
                        <span className="comment-author">{comment.author_name || comment.user_name}</span>
                        <span className="comment-time">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p>{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form className="comment-form" onSubmit={handleAddComment}>
              <input
                type="text"
                className="form-input"
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                <FiSend />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column - Time Logs */}
        <div className="task-sidebar">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <FiClock /> Time Logs
              </h3>
            </div>
            <div className="time-logs">
              {timers.length === 0 ? (
                <p className="no-logs">Task not started - No time logs yet</p>
              ) : (
                timers.map((timer) => (
                  <div key={timer.id} className={`time-log ${!timer.end_time ? 'active' : ''}`}>
                    <div className="log-header">
                      <span className="log-date">
                        {new Date(timer.start_time).toLocaleDateString()}
                      </span>
                      {!timer.end_time && (
                        <span className="badge badge-success">Active</span>
                      )}
                    </div>
                    <div className="log-times">
                      <span>{new Date(timer.start_time).toLocaleTimeString()}</span>
                      <span>→</span>
                      <span>
                        {timer.end_time 
                          ? new Date(timer.end_time).toLocaleTimeString()
                          : 'Running...'}
                      </span>
                    </div>
                    {timer.duration_seconds > 0 && (
                      <div className="log-duration">
                        Duration: {formatTime(timer.duration_seconds)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetails;






