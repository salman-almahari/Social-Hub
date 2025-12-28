"use client";

import { useState, useEffect } from 'react';
import { Button } from '../components/button';
import { toast } from 'sonner';
import { useEventNotifications } from '../context/EventNotificationsContext';

interface GroupEvent {
  id: number;
  groupId: number;
  title: string;
  description: string;
  eventTime: string;
  createdBy: string;
  goingCount: number;
  notGoingCount: number;
  userResponse?: "going" | "not_going" | null;
}

interface GroupEventsProps {
  groupId: number;
  groupName: string;
}


export default function GroupEvents({ groupId, groupName }: GroupEventsProps) {
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    eventTime: "",
  });
  const { markEventAsRead } = useEventNotifications();

  // Get current date and time in local timezone
  const getCurrentDateTime = () => {
    const now = new Date();
    // Format: YYYY-MM-DDThh:mm
    return now.toISOString().slice(0, 16);
  };

  // Validate if the selected date/time is in the future or current time
  const isValidDateTime = (dateTimeStr: string) => {
    const selected = new Date(dateTimeStr);
    const now = new Date();
    // Allow current time (within the same minute) or future times
    now.setSeconds(0, 0);
    return selected >= now;
  };

  useEffect(() => {
    fetchEvents();
  }, [groupId]);

  // Mark events as read when component mounts
  useEffect(() => {
    const markEventsAsRead = async () => {
      // Get all events for this group and mark them as read
      for (const event of events) {
        await markEventAsRead(event.id);
      }
    };
    
    if (events.length > 0) {
      markEventsAsRead();
    }
  }, [events, markEventAsRead]);

  const fetchEvents = async () => {
    try {
      const response = await fetch(`http://localhost:8080/group-events?groupId=${groupId}`, {
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      const data = await response.json();
      
      // Handle empty data case and convert event times to local timezone
      const eventsWithLocalTime = data && data.length > 0 
        ? data.map((event: GroupEvent) => ({
        ...event,
        eventTime: new Date(event.eventTime).toLocaleString()
          }))
        : [];
      setEvents(eventsWithLocalTime);
    } catch (error) {
      toast.error("Failed to load events");
      console.error("Error fetching events:", error);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate date/time
    if (!isValidDateTime(newEvent.eventTime)) {
      toast.error("Event time cannot be in the past");
      return;
    }

    setLoading(true);

    try {
      console.log('Creating event with data:', {
        groupId,
        title: newEvent.title,
        description: newEvent.description,
        eventTime: newEvent.eventTime,
      });

      const response = await fetch("http://localhost:8080/create-group-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupId,
          title: newEvent.title,
          description: newEvent.description,
          eventTime: newEvent.eventTime,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(errorText || "Failed to create event");
      }

      const newEventData = await response.json();
      console.log('Server response for new event:', newEventData); // Debug log

      // Ensure we have all required fields
      if (!newEventData.id || !newEventData.title || !newEventData.description) {
        // If the server response is incomplete, fetch all events again
        await fetchEvents();
      } else {
        // Convert the new event's time to local timezone and ensure all fields are present
        const newEventWithLocalTime = {
          ...newEventData,
          eventTime: new Date(newEventData.eventTime).toLocaleString(),
          goingCount: newEventData.goingCount || 0,
          notGoingCount: newEventData.notGoingCount || 0,
          userResponse: newEventData.userResponse || null,
          createdBy: newEventData.createdBy || 'You'
        };
        
        // Add the new event at the beginning of the list
        setEvents(prevEvents => [newEventWithLocalTime, ...prevEvents]);
      }
      
      toast.success("Event created successfully");
      setShowCreateForm(false);
      setNewEvent({ title: "", description: "", eventTime: "" });
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (eventId: number, response: "going" | "not_going") => {
    try {
      const res = await fetch("http://localhost:8080/respond-to-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          response,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to submit response");
      }

      toast.success("Response submitted successfully");
      // Refresh events to get updated data from the database
      fetchEvents();
    } catch (error) {
      toast.error("Failed to submit response");
      console.error("Error submitting response:", error);
    }
  };

  // Separate events into voted and not voted
  const votedEvents = events.filter(event => event.userResponse === "going" || event.userResponse === "not_going");
  const notVotedEvents = events.filter(event => event.userResponse === null || event.userResponse === undefined);

  console.log('Voted events:', votedEvents); // Debug log
  console.log('Not voted events:', notVotedEvents); // Debug log

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Group Events</h3>
          <p className="text-gray-600 mt-1">Plan and organize group activities</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-600 text-white rounded-xl hover:from-pink-700 hover:to-pink-700 transition-all font-medium flex items-center space-x-2"
        >
          {showCreateForm ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Cancel</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Create Event</span>
            </>
          )}
        </button>
      </div>

      {/* Create Event Form */}
      {showCreateForm && (
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-pink-600 to-pink-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h4 className="text-xl font-semibold text-gray-900">Create New Event</h4>
              <p className="text-gray-600">Plan something exciting for your group</p>
            </div>
          </div>

          <form onSubmit={handleCreateEvent} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Title</label>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                required
                disabled={loading}
                maxLength={100}
                placeholder="What's the event called?"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                rows={4}
                required
                disabled={loading}
                maxLength={1000}
                placeholder="Tell everyone about the event..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Date & Time</label>
              <input
                type="datetime-local"
                value={newEvent.eventTime}
                onChange={(e) => setNewEvent({ ...newEvent, eventTime: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                required
                disabled={loading}
                min={getCurrentDateTime()}
              />
              <p className="text-sm text-gray-500 mt-2 flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Select current time or a future date and time for your event</span>
              </p>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-pink-600 to-pink-600 text-white rounded-xl hover:from-pink-700 hover:to-pink-700 transition-all disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? "Creating Event..." : "Create Event"}
            </button>
          </form>
        </div>
      )}

      {/* Events Sections */}
      <div className="space-y-8">
        {/* Pending Votes Section */}
        <div>
          <div className="bg-gradient-to-r from-red-600 to-pink-600 rounded-3xl p-6 mb-6">
            <div className="flex items-center space-x-3 text-white">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="text-xl font-bold">Pending Your Response</h4>
                <p className="text-orange-100">Events waiting for your RSVP</p>
              </div>
            </div>
          </div>
          
          {notVotedEvents.length > 0 ? (
            <div className="grid gap-6">
              {notVotedEvents.map((event) => (
                <div key={event.id} className="bg-white rounded-3xl shadow-xl p-6 border-l-8 border-red-600">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h5 className="text-xl font-semibold text-gray-900 mb-2 break-words overflow-x-auto">{event.title}</h5>
                      <p className="text-gray-600 mb-3 leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-[150px] break-words">{event.description}</p>
                      <div className="flex items-center text-sm text-gray-500 space-x-4">
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>Created by {event.createdBy}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{event.eventTime}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1 text-green-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">{event.goingCount}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-red-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">{event.notGoingCount}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleResponse(event.id, "going")}
                      className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-500 text-white rounded-xl hover:from-green-600 hover:to-green-600 transition-all font-medium flex items-center justify-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>I'm Going</span>
                    </button>
                    <button
                      onClick={() => handleResponse(event.id, "not_going")}
                      className="flex-1 py-3 bg-gradient-to-r from-red-600 to-red-600 text-white rounded-xl hover:from-red-700 hover:to-red-700 transition-all font-medium flex items-center justify-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      <span>Can't Make It</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-gray-100 rounded-full p-6 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">All Caught Up!</h3>
              <p className="text-gray-500">You've responded to all pending events</p>
            </div>
          )}
        </div>

        {/* Voted Events Section */}
        <div>
          <div className="bg-gradient-to-r from-sky-600 to-sky-600 rounded-3xl p-6 mb-6">
            <div className="flex items-center space-x-3 text-white">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="text-xl font-bold">Your Responses</h4>
                <p className="text-blue-100">Events you've already responded to</p>
              </div>
            </div>
          </div>
          
          {votedEvents.length > 0 ? (
            <div className="grid gap-6">
              {votedEvents.map((event) => (
                <div key={event.id} className="bg-white rounded-3xl shadow-xl p-6 border-l-8 border-sky-500">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="text-xl font-semibold text-gray-900">{event.title}</h5>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          event.userResponse === "going" 
                            ? "bg-green-100 text-green-800" 
                            : "bg-red-100 text-red-800"
                        }`}>
                          {event.userResponse === "going" ? "✓ Going" : "✗ Not Going"}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3 leading-relaxed">{event.description}</p>
                      <div className="flex items-center text-sm text-gray-500 space-x-4">
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>Created by {event.createdBy}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{event.eventTime}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1 text-green-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">{event.goingCount}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-red-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">{event.notGoingCount}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleResponse(event.id, "going")}
                      className={`flex-1 py-3 rounded-xl transition-all font-medium flex items-center justify-center space-x-2 ${
                        event.userResponse === "going"
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>Going</span>
                    </button>
                    <button
                      onClick={() => handleResponse(event.id, "not_going")}
                      className={`flex-1 py-3 rounded-xl transition-all font-medium flex items-center justify-center space-x-2 ${
                        event.userResponse === "not_going"
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      <span>Not Going</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-gray-100 rounded-full p-6 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Events Yet</h3>
              <p className="text-gray-500">You haven't responded to any events yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}