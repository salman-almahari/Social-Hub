// import { GroupsList } from './groups';

// // Update the return statement to include GroupsList
// const GroupsPage = () => {
//     return (<>
    
//         <div className="max-w-4xl mx-auto p-6">
//             <h1 className="text-3xl font-bold text-gray-800 mb-8">Groups</h1>

//             {/* Existing Create Group Card */}

//             {/* Add Groups List */}
//             <div className="mt-8">
//                 <h2 className="text-2xl font-semibold text-gray-700 mb-4">Existing Groups</h2>
//                 <GroupsList />
//             </div>
//         </div>
//         </>
//     );
// };

// export default GroupsPage;
"use client";
import { Groups } from "./groups";

export default function ChatPage() {
    return <Groups />;
}
